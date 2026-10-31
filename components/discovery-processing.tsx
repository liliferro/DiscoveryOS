"use client";
import { useEffect, useState } from "react";
import { AudioLines, Heart, Sparkles } from "lucide-react";
import type { DiscoveryFact } from "@/lib/discovery-facts";

export default function DiscoveryProcessing({
  first,
  answered,
  fact,
  onNextFact,
}: {
  first: boolean;
  answered: number;
  fact: DiscoveryFact | null;
  onNextFact: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed++;
      setSeconds(elapsed);
      if (elapsed % 8 === 0) onNextFact();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onNextFact]);
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
      <div
        className="processing-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {fact ? (
          <div
            className="processing-fact"
            key={fact.id}
            data-testid="loading-fact"
            data-fact-id={fact.id}
          >
            <span className="processing-fact-topic">
              ¿SABÍAS QUE…? · {fact.topic}
            </span>
            <h1>{fact.text}</h1>
            {fact.url ? (
              <a href={fact.url} target="_blank" rel="noopener noreferrer">
                Fuente: {fact.source}
              </a>
            ) : (
              <small>Fuente: {fact.source}</small>
            )}
          </div>
        ) : (
          <p className="processing-message" key={phase}>
            {messages[phase]}
          </p>
        )}
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
