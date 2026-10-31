"use client";
import { useEffect, useState } from "react";
import { AudioLines, Heart, Sparkles } from "lucide-react";

export default function DiscoveryProcessing({
  first,
  answered,
}: {
  first: boolean;
  answered: number;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const messages = first
    ? [
        "Queremos empezar por lo que es importante para ti.",
        "Una pregunta a la vez, a tu ritmo.",
        "Estamos preparando una conversación a tu medida.",
      ]
    : [
        "Cada detalle que compartes nos ayuda a conocerte mejor.",
        "Tu siguiente pregunta tendrá en cuenta lo que nos contaste.",
        "No hay respuestas perfectas: lo importante es lo que tú buscas.",
      ];
  const phase = Math.min(2, Math.floor(seconds / 5));
  return (
    <section
      className="discovery-processing"
      aria-label="Preparando tu siguiente paso"
      aria-busy="true"
    >
      <span className="processing-eyebrow">
        {first
          ? "VAMOS A CONOCERNOS"
          : `GRACIAS POR TU RESPUESTA · ${answered} ${answered === 1 ? "RESPUESTA COMPARTIDA" : "RESPUESTAS COMPARTIDAS"}`}
      </span>
      <div className="processing-orbit" aria-hidden="true">
        <div className="processing-halo" />
        <div className="processing-core">
          <AudioLines size={38} strokeWidth={1.5} />
        </div>
        <span className="processing-spark">
          <Sparkles size={18} />
        </span>
        <span className="processing-heart">
          <Heart size={16} />
        </span>
      </div>
      <h1>
        {first
          ? "Una conversación que empieza contigo."
          : "Lo que nos cuentas importa."}
      </h1>
      <div
        className="processing-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="processing-message" key={phase}>
          {messages[phase]}
        </p>
        <span className="processing-current">
          {seconds >= 20
            ? "Está tardando un poco más. Seguimos esperando la respuesta; no necesitas enviarla de nuevo."
            : first
              ? "Preparando tu primera pregunta…"
              : "Preparando tu siguiente paso…"}
        </span>
      </div>
      <div className="processing-track" aria-hidden="true">
        <span />
      </div>
      <div className="processing-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="processing-footnote">
        Tómate este momento para ti. La conversación continuará aquí.
      </p>
    </section>
  );
}
