import type { Report } from "@/lib/domain";
export default function ReportView({ report }: { report: Report }) {
  return (
    <div className="report">
      <div className="notice">
        Informe de demostración · investigación e IA simuladas · sin fuentes
        externas verificadas
      </div>
      <div className="report-head">
        <div>
          <span className="eyebrow">TU SIGUIENTE CAPÍTULO</span>
          <h2>Una dirección más clara.</h2>
          <p>{report.summary}</p>
        </div>
        <div className="score">
          <strong>
            {report.score ?? "—"}
            <small>/100</small>
          </strong>
          <span>Señales de preparación</span>
          <small>Cobertura: {report.coverage}%</small>
        </div>
      </div>
      <p className="muted small">
        Método demo: sitio web, medición y proceso definido; tres respuestas de
        igual peso. Mínimo de cobertura: 60%. No mide el potencial ni el valor
        de tu negocio.
      </p>
      <h3>Lo que encontramos</h3>
      <div className="finding-grid">
        {report.findings.map((f, i) => (
          <article className="card" key={f.title}>
            <span className="index">0{i + 1}</span>
            <h3>{f.title}</h3>
            <p>{f.detail}</p>
            <span className="tag">{f.provenance}</span>
            {f.sourceId && (
              <a className="text-link" href={"#" + f.sourceId}>
                Ver ejemplo de evidencia ↗
              </a>
            )}
          </article>
        ))}
      </div>
      <h3>Un plan para avanzar</h3>
      <div className="timeline">
        {report.actions.map((a) => (
          <div key={a.day}>
            <span>{a.day} días</span>
            <p>{a.text}</p>
          </div>
        ))}
      </div>
      <h3>Evidencias y limitaciones</h3>
      {report.sources.map((s) => (
        <div className="evidence" key={s.id} id={s.id}>
          <strong>{s.title}</strong>
          <p>{s.excerpt}</p>
          <small>Fuente sintética. No corresponde a una página visitada.</small>
        </div>
      ))}
      <div className="cta-panel">
        <span className="eyebrow">{report.tenantName}</span>
        <h2>{report.cta}</h2>
        <p>
          {report.services.length
            ? `Servicios que podríamos explorar: ${report.services.join(" · ")}.`
            : "No hay suficiente evidencia para sugerir un servicio del catálogo."}
        </p>
        <p className="small">
          En el piloto se habilitará el contacto con la empresa. Esta demo no
          envía solicitudes.
        </p>
        <button className="button secondary" onClick={() => window.print()}>
          Imprimir informe
        </button>
      </div>
    </div>
  );
}
