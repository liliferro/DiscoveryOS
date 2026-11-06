"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LandingHeader, JourneySteps, JourneyIntro } from "./landing-journey";
import DentalMap from "./dental-map";
import type { DentalMapValue } from "@/lib/dental-map";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LoaderCircle, Check } from "lucide-react";
import type { Run, Config } from "@/lib/domain";
import { api } from "@/lib/client";
import { brandStyle } from "@/lib/brand";
import LeadSummary from "./lead-summary";
import DiscoveryProcessing from "./discovery-processing";
import {
  identifyFacts,
  rotateFact,
  type DiscoveryFact,
} from "@/lib/discovery-facts";
export default function AdaptiveSession({
  initialRun,
  info,
}: {
  initialRun?: Run;
  info?: {
    name: string;
    color: string;
    logoUrl?: string;
    slug: string;
    version: { config: Config };
  };
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [index, setIndex] = useState(
    Math.max(0, (initialRun?.conversation?.turns.length || 1) - 1),
  );
  const [answer, setAnswer] = useState(
    initialRun?.conversation?.turns.at(-1)?.answer || "",
  );
  const [consent, setConsent] = useState(false);
  const [contactName, setContactName] = useState(
    initialRun?.contact?.name || "",
  );
  const [contactWhatsapp, setContactWhatsapp] = useState(
    initialRun?.contact?.whatsapp || "",
  );
  const [contactEmail, setContactEmail] = useState(
    initialRun?.contact?.email || "",
  );
  const [contactConsent, setContactConsent] = useState(!!initialRun?.contact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapScreen, setMapScreen] = useState(false);
  const [dentalMap, setDentalMap] = useState<DentalMapValue>(
    initialRun?.dentalMap || { skipped: false, teeth: [] },
  );
  const c = run?.conversation;
  const config = run?.config || info?.version.config;
  const dental = !!config?.dentalMapEnabled;
  const questionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!busy) questionHeading.current?.focus({ preventScroll: true });
  }, [busy, index, c?.revision]);
  const turn = c?.turns[index];
  const name = run?.brand?.name || info?.name;
  const color = run?.brand?.color || info?.color;
  const [operation, setOperation] = useState<string>();
  const [loadingFact, setLoadingFact] = useState<DiscoveryFact | null>(null);
  const seenFacts = useRef(new Set<string>());
  const runId = run?.id;
  const factInputs =
    run?.config.loadingFacts || info?.version.config.loadingFacts;
  const facts = useMemo(() => identifyFacts(factInputs || []), [factInputs]);
  const lastFact = useRef<string>(undefined);
  const nextLoadingFact = useCallback(() => {
    if (!runId) return;
    const storageKey = `discovery-facts:v1:${runId}`;
    try {
      const stored: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) || "[]",
      );
      if (Array.isArray(stored))
        for (const id of stored)
          if (typeof id === "string") seenFacts.current.add(id);
      if (
        !lastFact.current &&
        Array.isArray(stored) &&
        typeof stored.at(-1) === "string"
      )
        lastFact.current = stored.at(-1);
    } catch {
      /* La rotación sigue funcionando en memoria si el almacenamiento está bloqueado. */
    }
    const fact = rotateFact(facts, seenFacts.current, lastFact.current);
    lastFact.current = fact?.id;
    setLoadingFact(fact);
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify([...seenFacts.current]),
      );
    } catch {
      /* Sin datos personales. */
    }
  }, [facts, runId]);
  async function start(mapConfirmed = false) {
    if (run && dental && !mapConfirmed) {
      setMapScreen(true);
      setError("");
      return;
    }
    nextLoadingFact();
    setBusy(true);
    setError("");
    try {
      if (!run) {
        const next = await api<{ id: string }>("public/runs", "POST", {
          slug: info?.slug,
        });
        router.push("/r/" + next.id);
        return;
      }
      if (run.contactRequired && !c?.turns.length) {
        const saved = await api<Run>(`public/runs/${run.id}/contact`, "PUT", {
          name: contactName,
          whatsapp: contactWhatsapp,
          email: contactEmail,
          consent: contactConsent,
        });
        setRun(saved);
      }
      await advance(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function advance(selectFact = true) {
    if (!run) return;
    if (turn?.answer === answer.trim() && c?.turns[index + 1]) {
      setIndex(index + 1);
      setAnswer(c.turns[index + 1].answer || "");
      setOperation(undefined);
      setError("");
      return;
    }
    if (selectFact) nextLoadingFact();
    setBusy(true);
    setError("");
    const operationId = operation || crypto.randomUUID();
    setOperation(operationId);
    try {
      const next = await api<Run>(
        `public/runs/${run.id}/conversation`,
        "POST",
        {
          revision: c?.revision || 0,
          operationId,
          privacy: consent || run.privacy,
          ...(!turn && dental ? { dentalMap } : {}),
          ...(turn ? { index, answer: answer.trim() } : {}),
        },
      );
      setRun(next);
      setIndex(Math.max(0, (next.conversation?.turns.length || 1) - 1));
      setAnswer(next.conversation?.turns.at(-1)?.answer || "");
      setOperation(undefined);
    } catch (e) {
      setError((e as Error).message);
      const latest = await api<Run>(`public/runs/${run.id}`).catch(() => null);
      if (latest) {
        setRun(latest);
        if ((latest.conversation?.revision || 0) !== (c?.revision || 0)) {
          setIndex(Math.max(0, (latest.conversation?.turns.length || 1) - 1));
          setAnswer(latest.conversation?.turns.at(-1)?.answer || "");
          setOperation(undefined);
        }
      }
    } finally {
      setBusy(false);
    }
  }
  const insight =
    index > 0
      ? c?.turns[index - 1].decision?.insight
      : c?.turns.length === 1
        ? c.decision?.insight
        : "";
  return (
    <div
      className="public-app adaptive-app journey-app"
      style={brandStyle(color) as React.CSSProperties}
    >
      <LandingHeader
        name={name}
        logoUrl={run?.brand.logoUrl || info?.logoUrl}
        config={config}
      />
      <main className={c?.closed ? "public-report" : "public-main"}>
        <JourneySteps
          dental={dental}
          stage={
            c?.closed
              ? dental
                ? 4
                : 3
              : c?.turns.length
                ? dental
                  ? 3
                  : 2
                : mapScreen
                  ? 2
                  : run
                    ? 1
                    : 0
          }
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {busy ? (
          <DiscoveryProcessing
            first={!c?.turns.length}
            answered={index + 1}
            fact={loadingFact}
            onNextFact={nextLoadingFact}
          />
        ) : c?.closed && run ? (
          <LeadSummary run={run} />
        ) : mapScreen && !c?.turns.length ? (
          <DentalMap
            value={dentalMap}
            onChange={setDentalMap}
            onContinue={() => {
              void start(true);
            }}
            onBack={() => setMapScreen(false)}
          />
        ) : !c?.turns.length ? (
          <form
            className={run ? "welcome contact-welcome" : "welcome"}
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            <span className="eyebrow">
              {name?.toUpperCase()} / UNA CONVERSACIÓN A TU MEDIDA
            </span>
            <h1>{info?.version.config.title || run?.config.title}</h1>
            <p>{info?.version.config.description || run?.config.description}</p>
            {!run && <JourneyIntro dental={dental} />}
            {run && (
              <>
                {run.contactRequired && (
                  <fieldset className="lead-contact-form">
                    <legend>
                      Antes de empezar, ¿cómo podemos contactarte?
                    </legend>
                    <p>
                      Guardaremos tus datos para que el equipo de {name} pueda
                      atender tu solicitud. La IA recibirá las respuestas que
                      escribas durante la conversación.
                    </p>
                    <label>
                      Tu nombre
                      <input
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </label>
                    <label>
                      Tu WhatsApp con código de país
                      <input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        required
                        maxLength={40}
                        pattern="\+[0-9\s\(\)\-]{8,39}"
                        title="Incluye + y el código de país, por ejemplo +52 55 1234 5678."
                        placeholder="+52 55 1234 5678"
                        value={contactWhatsapp}
                        onChange={(e) => setContactWhatsapp(e.target.value)}
                      />
                    </label>
                    <label>
                      Tu correo electrónico
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={contactConsent}
                        onChange={(e) => setContactConsent(e.target.checked)}
                      />
                      Autorizo que {name} use estos datos para contactarme y
                      atender esta solicitud.
                    </label>
                  </fieldset>
                )}
                <div className="consents">
                  <p>
                    <strong>Antes de empezar · prueba de discovery</strong>
                    <br />
                    Tus respuestas
                    {dental ? " y la selección del mapa dental" : ""} se
                    enviarán al proveedor de IA configurado para personalizar
                    las preguntas y se guardarán en la plataforma. No incluyas
                    nombres, datos de contacto, documentos ni información
                    clínica sensible en las respuestas a la conversación.
                    Utiliza un caso ficticio mientras validamos el piloto.
                  </p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Entiendo el uso de mis respuestas con IA en esta prueba.
                  </label>
                </div>
              </>
            )}
            <button
              className="button primary"
              disabled={
                busy ||
                (!!run && !consent) ||
                (!!run?.contactRequired &&
                  (!contactName.trim() ||
                    !contactWhatsapp.trim() ||
                    !contactEmail.trim() ||
                    !contactConsent))
              }
              type="submit"
            >
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Preparando tu primera pregunta…
                </>
              ) : (
                <>
                  {run ? "Comenzar conversación" : "Explorar mi siguiente paso"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
            <p className="adaptive-note">
              Puedes responder con tus palabras o indicar que prefieres no
              contestar. La conversación no sustituye una valoración
              profesional.
            </p>
          </form>
        ) : (
          <section className="adaptive-question">
            <div className="question-progress">
              <span>UNA CONVERSACIÓN, TU CONTEXTO</span>
              <span>Pregunta {index + 1}</span>
            </div>
            {insight && (
              <div className="listening">
                <span className="eyebrow">LO QUE ESTAMOS ENTENDIENDO</span>
                <p>{insight}</p>
              </div>
            )}
            <h1 ref={questionHeading} tabIndex={-1}>
              {turn?.question.text}
            </h1>
            <p className="question-why">{turn?.question.why}</p>
            <div className="choice-list">
              {turn?.question.options.map((option) => (
                <button
                  className={answer === option ? "choice selected" : "choice"}
                  aria-pressed={answer === option}
                  key={option}
                  disabled={busy}
                  onClick={() => {
                    setAnswer(option);
                    setOperation(undefined);
                  }}
                >
                  <span>{option}</span>
                  <span className="choice-check">
                    {answer === option && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
            <label className="free-answer">
              Cuéntalo con tus palabras
              <textarea
                aria-label="Tu respuesta"
                value={answer}
                maxLength={2500}
                disabled={busy}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setOperation(undefined);
                }}
                placeholder="Puedes añadir detalles, matizar o decir que prefieres no responder…"
              />
            </label>
            <div className="question-actions">
              <button
                className="text-link"
                disabled={busy || index === 0}
                onClick={() => {
                  const previous = index - 1;
                  setIndex(previous);
                  setAnswer(c?.turns[previous].answer || "");
                  setOperation(undefined);
                  setError("");
                }}
              >
                <ArrowLeft size={16} />
                Anterior
              </button>
              <button
                className="button primary"
                disabled={busy || !answer.trim()}
                onClick={() => advance()}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Entendiendo tu respuesta…
                  </>
                ) : (
                  <>
                    {error ? "Reintentar" : "Continuar"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            {index < (c?.turns.length || 0) - 1 && (
              <div className="notice">
                Al continuar desde esta pregunta, el tramo siguiente se vuelve a
                generar con tu respuesta actualizada.
              </div>
            )}
            <p className="adaptive-note">
              Tus respuestas enviadas están guardadas. Puedes volver a esta URL
              desde este navegador.{" "}
              {c?.provider === "fixture"
                ? "Modo de prueba automatizada."
                : "Preguntas y análisis generados por IA."}
            </p>
          </section>
        )}
      </main>
      <footer className="public-footer">
        POWERED BY DISCOVERY OS<span>Escuchar antes de proponer.</span>
      </footer>
    </div>
  );
}
