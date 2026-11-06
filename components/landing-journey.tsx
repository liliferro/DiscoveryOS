import {
  AudioLines,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import BrandLogo from "./brand-logo";
import type { Config } from "@/lib/domain";

export function LandingHeader({
  name,
  logoUrl,
  config,
}: {
  name?: string;
  logoUrl?: string;
  config?: Config;
}) {
  return (
    <header className="journey-header">
      <div className="journey-brand">
        {logoUrl && (
          <BrandLogo
            src={logoUrl}
            alt={`Logo de ${name}`}
            width={120}
            height={44}
            className="public-client-logo"
          />
        )}
        <span>
          {name || "Discovery"}
          <small>Una experiencia a tu medida</small>
        </span>
      </div>
      {config?.bookingUrl ? (
        <a
          className="journey-contact"
          href={config.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} /> Contactar <ArrowUpRight size={14} />
        </a>
      ) : (
        <span className="journey-private">
          <ShieldCheck size={17} /> Tu espacio de discovery
        </span>
      )}
    </header>
  );
}

export function JourneySteps({
  stage,
  dental = false,
}: {
  stage: number;
  dental?: boolean;
}) {
  const steps = dental
    ? ["Bienvenida", "Tus datos", "Mapa dental", "Conversación", "Tu resultado"]
    : ["Bienvenida", "Tus datos", "Conversación", "Tu resultado"];
  return (
    <ol className="journey-steps" aria-label="Etapas de tu discovery">
      {steps.map((label, index) => (
        <li
          key={label}
          className={
            index < stage ? "complete" : index === stage ? "current" : ""
          }
          aria-current={index === stage ? "step" : undefined}
        >
          <span className="journey-step-bar" />
          <span className="journey-step-label">
            {index < stage ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <span>{String(index + 1).padStart(2, "0")}</span>
            )}
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const features = [
  {
    icon: UserRound,
    title: "Tu punto de partida",
    text: "Nos cuentas qué buscas",
  },
  {
    icon: MessageCircle,
    title: "Una conversación",
    text: "Preguntas que se adaptan a ti",
  },
  {
    icon: Sparkles,
    title: "Tus posibilidades",
    text: "Explora tu siguiente paso",
  },
  {
    icon: ShieldCheck,
    title: "A tu ritmo",
    text: "Con espacio para tus dudas",
  },
];
export function JourneyIntro({ dental }: { dental?: boolean }) {
  return (
    <>
      <div className="journey-preview">
        <div>
          <span className="eyebrow">TU HISTORIA ES EL PUNTO DE PARTIDA</span>
          <h2>
            Una conversación.
            <br />
            Un camino para ti.
          </h2>
          <p>
            {dental
              ? "Empieza con tu mapa dental y descubre qué te gustaría mejorar."
              : "Conecta lo que necesitas con las opciones que puedes explorar."}
          </p>
        </div>
        <div className="journey-orbit" aria-hidden="true">
          <span />
          <span />
          <div>
            <AudioLines size={40} />
          </div>
          <i />
          <b />
        </div>
      </div>
      <div className="journey-features">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span>
              <Icon size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
