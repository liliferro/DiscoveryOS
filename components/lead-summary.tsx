"use client";
import type { Run } from "@/lib/domain";
import { ArrowRight, Check, CalendarDays } from "lucide-react";
import LeadContactCard from "./lead-contact-card";
import { dentalMapSummary } from "@/lib/dental-map";
export default function LeadSummary({
  run,
  internal = false,
}: {
  run: Run;
  internal?: boolean;
}) {
  const c = run.conversation;
  const d = c?.decision;
  const isDental =
    run.tenantId === "dental" || /odont|dental/i.test(run.brand.industry || "");
  if (!c || !d) return null;
  if (!internal) {
    const options =
      run.patientResult?.options ||
      d.segments.filter((s) => s.interest !== "not_interested");
    const bookingUrl = run.patientResult?.bookingUrl ?? run.config.bookingUrl;
    return (
      <section className="lead-summary patient-result">
        <span className="patient-complete">
          <Check size={22} /> Conversación completada
        </span>
        <h1>
          Gracias por contarnos
          <br />
          lo que buscas.
        </h1>
        <p className="lead-text">
          {d.handoff
            ? "Gracias por compartir tu situación. El siguiente paso es hablar con un profesional que pueda atenderte personalmente."
            : options.length > 1
              ? "Por lo que nos compartiste, hay varias opciones que vale la pena explorar contigo en una valoración. Te contamos por qué."
              : options.length === 1
                ? "Tus respuestas nos ayudan a entender qué quieres mejorar. Esta es una opción que puedes explorar con el equipo en tu valoración."
                : "Tus respuestas nos ayudan a preparar una conversación más útil contigo. Una valoración con el equipo permitirá aclarar tus opciones y resolver tus dudas."}
        </p>
        {!d.handoff && options.length > 0 && (
          <div className="segment-grid patient-options">
            {options.map((option) => (
              <article className="card" key={option.service}>
                <span className="eyebrow">UNA OPCIÓN PARA VALORAR CONTIGO</span>
                <h2>{option.service}</h2>
                <p>{option.reason}</p>
                <small>
                  En una conversación con el equipo podremos revisar si esta
                  opción se ajusta a lo que buscas y qué alternativas existen.
                </small>
              </article>
            ))}
          </div>
        )}
        {d.handoff ? (
          <div className="notice">
            {d.nextSteps.map((step, i) => (
              <p key={i}>{step}</p>
            ))}
          </div>
        ) : (
          <>
            <div className="patient-booking card">
              <CalendarDays size={28} aria-hidden="true" />
              <h2>El siguiente paso es conocernos.</h2>
              <p>
                Habla con {run.brand.name}. El equipo podrá escucharte y
                explicarte las opciones antes de que tomes una decisión.
              </p>
              {bookingUrl ? (
                <a
                  className="button primary"
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {run.config.ctaLabel || "Agendar mi valoración"}{" "}
                  <ArrowRight size={18} />
                </a>
              ) : run.config.contactEmail ? (
                <a
                  className="button primary"
                  href={`mailto:${encodeURIComponent(run.config.contactEmail)}`}
                >
                  {run.config.ctaLabel || "Contactar al equipo"}{" "}
                  <ArrowRight size={18} />
                </a>
              ) : (
                <p className="notice">
                  El equipo aún no ha publicado su enlace de agenda.
                </p>
              )}
              {bookingUrl && new URL(bookingUrl).hostname === "wa.me" && (
                <small>
                  {isDental
                    ? "Te llevaremos a WhatsApp para solicitar tu cita. Tú decides cuándo enviar el mensaje."
                    : "Te llevaremos a WhatsApp para contactar al equipo. Tú decides cuándo enviar el mensaje."}
                </small>
              )}
            </div>
            <p className="small muted patient-footnote">
              {isDental
                ? "Esta orientación se basa en lo que nos contaste. La valoración odontológica confirmará qué tratamientos son adecuados para ti."
                : "Esta orientación se basa en tus respuestas. El equipo te ayudará a confirmar qué opciones se ajustan a tus necesidades."}
            </p>
          </>
        )}
        <p className="small muted">
          Tus respuestas y el resultado quedaron guardados para que el equipo
          pueda revisarlos. El siguiente paso se confirma directamente con el
          equipo.
        </p>
      </section>
    );
  }
  return (
    <div className="lead-summary">
      <span className="tag">
        {c.provider === "fixture"
          ? "Prueba automatizada · IA simulada"
          : `Conversación con IA · ${c.provider === "anthropic" ? "Claude" : "OpenAI"}`}
      </span>
      <h1>Esto es lo que nos contaste.</h1>
      {run.contact && <LeadContactCard contact={run.contact} />}
      {run.dentalMap && (
        <div className="notice">
          <strong>Mapa dental · información aportada por la persona</strong>
          <p>{dentalMapSummary(run.dentalMap)}</p>
        </div>
      )}
      <span className="tag">
        Resultado guardado · pendiente de revisión del equipo
      </span>
      <p className="lead-text">{d.summary}</p>
      <div className="notice">
        {isDental
          ? "Esta conversación orienta el interés del visitante. No constituye diagnóstico, indicación de tratamiento ni confirmación de idoneidad."
          : "Esta conversación recoge intereses declarados para que el equipo pueda preparar el siguiente paso."}
      </div>
      {d.segments.length > 0 && (
        <>
          <h3>Intereses para conversar con el equipo</h3>
          <div className="segment-grid">
            {d.segments.map((s) => (
              <article className="card" key={s.service}>
                <span className="tag">
                  {s.interest === "explicit"
                    ? "Interés expresado"
                    : s.interest === "possible"
                      ? "Interés por explorar"
                      : "Sin interés en este servicio"}
                </span>
                <h3>{s.service}</h3>
                <p>{s.reason}</p>
                {internal && (
                  <small className="muted">
                    Respuestas de referencia: {s.evidence.join(", ")}
                  </small>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <h3>Un siguiente paso con más contexto</h3>
      <div className="timeline">
        {d.nextSteps.map((s, i) => (
          <div key={i}>
            <span>0{i + 1}</span>
            <p>{s}</p>
          </div>
        ))}
      </div>
      {internal && (
        <>
          <h3>Perfil y trazabilidad</h3>
          <div className="profile-grid">
            {d.profile.map((p) => (
              <div className="card" key={p.fieldId}>
                <small>
                  {run.config.discovery?.fields.find((f) => f.id === p.fieldId)
                    ?.label || p.fieldId}
                </small>
                <p>
                  {p.status === "known"
                    ? p.value
                    : p.status === "declined"
                      ? "Prefiere no responder"
                      : "Información pendiente"}
                </p>
                <small>Respuestas: {p.evidence.join(", ") || "—"}</small>
              </div>
            ))}
          </div>
          <p className="small muted">
            Versión del cuestionario: {run.version} · Revisión de conversación:{" "}
            {c.revision} · Modelo: {c.usage.at(-1)?.model} · {c.usage.length}{" "}
            respuestas registradas del proveedor.
          </p>
          <h3>Conversación completa</h3>
          {c.turns.map((t, i) => (
            <details className="evidence" key={t.id}>
              <summary>
                {i + 1}. {t.question.text}
              </summary>
              <p>{t.answer}</p>
              <small>{t.decision?.insight}</small>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
