"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  AudioLines,
  Check,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type { Answers, Config, Run } from "@/lib/domain";
import { stages, visibleAnswers } from "@/lib/domain";
import { api } from "@/lib/client";
import ReportView from "./report";
import AdaptiveSession from "./adaptive-session";
type PublicSession = {
  name: string;
  color: string;
  slug: string;
  version: { number: number; config: Config };
};
export default function Session({
  slug,
  runId,
}: {
  slug?: string;
  runId?: string;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<PublicSession>();
  const [run, setRun] = useState<Run>();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [scenario, setScenario] = useState("normal");
  const [saved, setSaved] = useState("");
  const hydrated = useRef(false);
  useEffect(() => {
    async function load() {
      try {
        if (runId) {
          const next = await api<Run>(`public/runs/${runId}`);
          setRun(next);
          setAnswers(next.answers);
          setPrivacy(next.privacy);
          setMarketing(next.marketing);
          hydrated.current = true;
        } else if (slug)
          setInfo(await api<PublicSession>(`public/sessions/${slug}`));
      } catch (e) {
        setError((e as Error).message);
      }
    }
    void load();
  }, [runId, slug]);
  useEffect(() => {
    if (!runId || !run || run.state !== "processing") return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        setRun(await api<Run>(`public/runs/${runId}`));
      } catch (e) {
        setError((e as Error).message);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [runId, run]);
  // Save only hydrated drafts. Abort delayed saves after navigation or submission.
  useEffect(() => {
    if (
      !runId ||
      run?.state !== "draft" ||
      run.config.mode === "adaptive" ||
      !hydrated.current
    )
      return;
    const timer = setTimeout(() => {
      setSaved("Guardando…");
      void api(`public/runs/${runId}/answers`, "PUT", {
        answers,
        privacy,
        marketing,
      })
        .then(() => setSaved("Progreso guardado"))
        .catch((e) => {
          setSaved("");
          setError(e.message);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [answers, privacy, marketing, runId, run?.state, run?.config.mode]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>("public/runs", "POST", { slug });
      router.push(`/r/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const config = run?.config || info?.version.config;
  const active = config ? visibleAnswers(config, answers) : {};
  const questions =
    config?.questions.filter(
      (q) =>
        !q.visibleIf || active[q.visibleIf.questionId] === q.visibleIf.value,
    ) || [];
  const current = questions[step];
  const review = step >= questions.length;
  async function save() {
    if (runId)
      await api(`public/runs/${runId}/answers`, "PUT", {
        answers,
        privacy,
        marketing,
      });
  }
  async function next() {
    setError("");
    setBusy(true);
    try {
      if (current?.required) {
        const v = answers[current.id];
        if (v === undefined || v === "" || (Array.isArray(v) && !v.length))
          throw Error("Responde esta pregunta para continuar");
      }
      await save();
      setStep(step + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setError("");
    setBusy(true);
    try {
      await save();
      await api(`public/runs/${runId}/submit`, "POST", { scenario });
      setRun(await api<Run>(`public/runs/${runId}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function answer(value: Answers[string]) {
    setAnswers({ ...answers, [current.id]: value });
    setSaved("");
    setError("");
  }
  if (config?.mode === "adaptive")
    return <AdaptiveSession key={runId || slug} initialRun={run} info={info} />;
  return (
    <div
      className="public-app"
      style={
        {
          "--brand": run?.brand?.color || info?.color || "#6756d8",
        } as React.CSSProperties
      }
    >
      <header className="public-header">
        <Link href="/" className="wordmark">
          <span className="logo">
            <AudioLines size={22} />
          </span>
          discovery<span className="os">OS</span>
        </Link>
        <span className="public-brand">{run?.brand?.name || info?.name}</span>
        <span className="demo-pill">
          <span /> Experiencia de demostración
        </span>
      </header>
      <main
        className={
          run?.report && run.state === "completed_limited"
            ? "public-report"
            : "public-main"
        }
      >
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!config && !error && <p>Cargando sesión…</p>}
        {info && !run && (
          <section className="welcome">
            <span className="eyebrow">
              {info.name.toUpperCase()} / DISCOVERY SESSION
            </span>
            <div className="welcome-symbol">
              <AudioLines size={58} />
            </div>
            <h1>
              Tu negocio tiene
              <br />
              una próxima oportunidad.
            </h1>
            <p>{info.version.config.description}</p>
            <div className="session-facts">
              <span>~ 5 minutos</span>
              <span>{info.version.config.questions.length} preguntas</span>
              <span>A tu ritmo</span>
            </div>
            <button className="button primary" onClick={start} disabled={busy}>
              Descubrir mi siguiente paso <ArrowRight size={17} />
            </button>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                Esta es una prueba local. Utiliza información ficticia. La
                investigación y el diagnóstico se simulan; no se visita tu
                sitio.
              </p>
            </div>
          </section>
        )}
        {run?.state === "draft" && config && (
          <section className="questionnaire">
            <div className="question-progress">
              <span>{config.title}</span>
              <span>
                {Math.min(step + 1, questions.length)} / {questions.length}
              </span>
            </div>
            <div className="progress-track">
              <div
                style={{
                  width: `${Math.min((step + 1) / questions.length, 1) * 100}%`,
                }}
              />
            </div>
            {current && !review ? (
              <>
                <span className="eyebrow">
                  CONOZCAMOS TU NEGOCIO · {String(step + 1).padStart(2, "0")}
                </span>
                <h1>{current.label}</h1>
                <p className="muted">
                  {current.required
                    ? "Una pieza importante para entender tu contexto."
                    : "Opcional · puedes continuar sin responder."}
                </p>
                <div className="answer-area">
                  {["text", "url", "number"].includes(current.type) && (
                    <input
                      autoFocus
                      key={current.id}
                      aria-label={current.label}
                      type={
                        current.type === "number"
                          ? "number"
                          : current.type === "url"
                            ? "url"
                            : "text"
                      }
                      placeholder={
                        current.type === "url"
                          ? "https://ejemplo.com"
                          : "Escribe tu respuesta…"
                      }
                      value={String(answers[current.id] ?? "")}
                      onChange={(e) =>
                        answer(
                          current.type === "number" && e.target.value !== ""
                            ? Number(e.target.value)
                            : e.target.value,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void next();
                      }}
                    />
                  )}
                  {current.type === "boolean" && (
                    <div className="choice-list">
                      {[
                        { label: "Sí", value: true },
                        { label: "No", value: false },
                      ].map((v) => (
                        <button
                          key={v.label}
                          className={
                            answers[current.id] === v.value
                              ? "choice selected"
                              : "choice"
                          }
                          onClick={() => answer(v.value)}
                        >
                          <span>{v.label}</span>
                          <span className="choice-check">
                            {answers[current.id] === v.value && (
                              <Check size={15} />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {["single", "multiple"].includes(current.type) && (
                    <div className="choice-list">
                      {current.options?.map((option, i) => {
                        const checked =
                          current.type === "single"
                            ? answers[current.id] === option
                            : (
                                (answers[current.id] as string[]) || []
                              ).includes(option);
                        return (
                          <button
                            key={option}
                            className={checked ? "choice selected" : "choice"}
                            onClick={() =>
                              answer(
                                current.type === "single"
                                  ? option
                                  : checked
                                    ? (answers[current.id] as string[]).filter(
                                        (v) => v !== option,
                                      )
                                    : [
                                        ...((answers[current.id] as string[]) ||
                                          []),
                                        option,
                                      ],
                              )
                            }
                          >
                            <span>
                              <small>{String.fromCharCode(65 + i)}</small>
                              {option}
                            </span>
                            <span className="choice-check">
                              {checked && <Check size={15} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="question-actions">
                  <button
                    className="text-link"
                    disabled={step === 0 || busy}
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft size={16} />
                    Anterior
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={next}
                  >
                    Continuar <ArrowRight size={17} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">ANTES DE CONECTAR LOS PUNTOS</span>
                <h1>Todo listo para tu discovery.</h1>
                <p>
                  Revisa tus respuestas. El informe será una simulación basada
                  en este contexto.
                </p>
                <div className="review-list">
                  {questions.map((q, i) => (
                    <button key={q.id} onClick={() => setStep(i)}>
                      <span>{q.label}</span>
                      <strong>
                        {Array.isArray(active[q.id])
                          ? (active[q.id] as string[]).join(", ")
                          : active[q.id] === true
                            ? "Sí"
                            : active[q.id] === false
                              ? "No"
                              : String(active[q.id] ?? "Sin respuesta")}
                      </strong>
                    </button>
                  ))}
                </div>
                <div className="consents">
                  <p>
                    <strong>Aviso de demostración · v0.1</strong>
                    <br />
                    Los datos se guardan en este equipo para probar
                    cuestionarios e informes. No ingreses datos personales ni
                    confidenciales. Puedes volver a esta URL desde este
                    navegador durante siete días.
                  </p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={privacy}
                      onChange={(e) => setPrivacy(e.target.checked)}
                    />
                    Entiendo el uso de mis datos ficticios en esta demostración.
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                    />
                    Deseo recibir novedades (opcional; no se enviarán en la
                    demo).
                  </label>
                </div>
                <label className="scenario-label">
                  Escenario de API simulada
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                  >
                    <option value="normal">Respuesta normal</option>
                    <option value="timeout">
                      Timeout y recuperación automática
                    </option>
                    <option value="unavailable">
                      Indisponibilidad · requiere reintento en panel
                    </option>
                  </select>
                </label>
                <div className="question-actions">
                  <button
                    className="text-link"
                    onClick={() => setStep(Math.max(0, questions.length - 1))}
                  >
                    <ArrowLeft size={16} />
                    Volver
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || !privacy}
                    onClick={submit}
                  >
                    Crear mi diagnóstico <ArrowRight size={17} />
                  </button>
                </div>
              </>
            )}
            <div className="save-state" role="status">
              <ShieldCheck size={14} />
              {saved || "Puedes volver usando esta URL en este navegador."}
            </div>
          </section>
        )}
        {run?.state === "processing" && (
          <section className="processing">
            <div className="processing-symbol">
              <LoaderCircle size={39} className="spin" />
            </div>
            <span className="eyebrow">CONECTANDO LOS PUNTOS</span>
            <h1>
              De tus respuestas
              <br />a nuevas posibilidades.
            </h1>
            <p>
              Procesamos un ejemplo local. Puedes volver más tarde a esta misma
              URL.
            </p>
            <div className="stage-list">
              {stages.map((stage, i) => (
                <div
                  key={stage}
                  className={
                    i < (run.job?.stage || 0)
                      ? "stage done"
                      : i === (run.job?.stage || 0)
                        ? "stage current"
                        : "stage"
                  }
                >
                  <span>
                    {i < (run.job?.stage || 0) ? <Check size={14} /> : i + 1}
                  </span>
                  {stage}
                  {i === (run.job?.stage || 0) && (
                    <LoaderCircle size={15} className="spin" />
                  )}
                </div>
              ))}
            </div>
            {run.job?.error && (
              <div className="notice">
                Fallo simulado: reintento programado. Intento {run.job.attempts}{" "}
                de 3.
              </div>
            )}
            <small className="muted">
              Los pasos se actualizan al guardarse cada etapa del trabajo.
            </small>
          </section>
        )}
        {run?.state === "failed" && (
          <section className="welcome">
            <h1>
              El análisis necesita
              <br />
              un nuevo intento.
            </h1>
            <p>
              El proveedor simulado no estuvo disponible después de tres
              intentos. Tus respuestas siguen guardadas.
            </p>
            <Link className="button primary" href="/">
              Abrir panel para reintentar <ArrowRight size={16} />
            </Link>
          </section>
        )}
        {run?.state === "completed_limited" && run.report && (
          <>
            <span className="eyebrow">
              DISCOVERY COMPLETADA / {String(run.answers.company)}
            </span>
            <ReportView report={run.report} />
          </>
        )}
      </main>
      <footer className="public-footer">
        POWERED BY DISCOVERY OS{" "}
        <span>Buenas preguntas. Mejores decisiones.</span>
      </footer>
    </div>
  );
}
