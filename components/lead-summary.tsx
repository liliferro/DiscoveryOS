"use client";
import type { Run } from "@/lib/domain";
export default function LeadSummary({
  run,
  internal = false,
}: {
  run: Run;
  internal?: boolean;
}) {
  const c = run.conversation;
  const d = c?.decision;
  if (!c || !d) return null;
  return (
    <div className="lead-summary">
      <span className="tag">
        {c.provider === "fixture"
          ? "Prueba automatizada · IA simulada"
          : `Conversación con IA · ${c.provider === "anthropic" ? "Claude" : "OpenAI"}`}
      </span>
      <h1>Esto es lo que nos contaste.</h1>
      <p className="lead-text">{d.summary}</p>
      <div className="notice">
        Esta conversación orienta el interés del visitante. No constituye
        diagnóstico, indicación de tratamiento ni confirmación de idoneidad.
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
      <p className="small muted">
        La conversación queda guardada en la plataforma. No se envían
        solicitudes de contacto desde esta versión.
      </p>
      <button className="button secondary" onClick={() => window.print()}>
        Imprimir resumen
      </button>
    </div>
  );
}
