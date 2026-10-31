import type { Config, Tenant } from "./domain.ts";
import { defaultDiscovery } from "./discovery.ts";
function config(industrial = false): Config {
  return {
    title: industrial
      ? "Discovery de operación B2B"
      : "Discovery de crecimiento",
    description: industrial
      ? "Identifica oportunidades para ordenar tu proceso comercial y tu operación."
      : "Una primera lectura de tu negocio para encontrar tu siguiente oportunidad de crecimiento.",
    questions: [
      {
        id: "company",
        label: "¿Cómo se llama tu empresa?",
        type: "text",
        required: true,
      },
      {
        id: "sector",
        label: "¿A qué se dedica tu empresa?",
        type: "text",
        required: true,
      },
      {
        id: "has_site",
        label: "¿Tienes un sitio web?",
        type: "boolean",
        required: true,
      },
      {
        id: "website",
        label: "Sitio web de tu empresa",
        type: "url",
        required: true,
        visibleIf: { questionId: "has_site", value: true },
      },
      {
        id: "goal",
        label: industrial
          ? "¿Qué proceso quieres mejorar?"
          : "¿Cuál es tu principal objetivo?",
        type: "single",
        required: true,
        options: industrial
          ? [
              "Generar oportunidades B2B",
              "Ordenar la operación",
              "Mejorar seguimiento comercial",
            ]
          : [
              "Atraer mejores clientes",
              "Mejorar mi posicionamiento",
              "Convertir más oportunidades",
            ],
      },
      {
        id: "channels",
        label: "¿Qué canales utilizas hoy?",
        type: "multiple",
        required: true,
        options: [
          "Referidos",
          "Sitio web",
          "Redes sociales",
          "Equipo comercial",
          "Publicidad",
        ],
      },
      {
        id: "measurement",
        label: industrial
          ? "¿Mides el avance de tus oportunidades?"
          : "¿Mides los resultados de tus canales?",
        type: "boolean",
        required: true,
      },
      {
        id: "process",
        label: industrial
          ? "¿Tienes un proceso comercial documentado?"
          : "¿Tienes un proceso de seguimiento definido?",
        type: "boolean",
        required: true,
      },
      {
        id: "challenge",
        label: "¿Cuál es el mayor obstáculo hoy?",
        type: "text",
        required: true,
      },
      {
        id: "team",
        label: "¿Cuántas personas forman tu equipo?",
        type: "number",
        required: false,
      },
    ],
  };
}
export function seed(): Tenant[] {
  return [
    {
      id: "mood",
      name: "Mood Agency",
      slug: "mood",
      color: "#6756d8",
      industry: "Estrategia & crecimiento",
      cta: "Conversemos sobre tu siguiente paso",
      services: [
        "Estrategia de crecimiento",
        "Medición y conversión",
        "Posicionamiento de marca",
      ],
      draft: config(),
      versions: [{ id: "mood-v1", number: 1, config: config() }],
    },
    {
      id: "norte",
      name: "Norte Industrial",
      slug: "norte",
      color: "#137c73",
      industry: "Operación & ventas B2B",
      cta: "Revisemos tu proceso comercial",
      services: [
        "Diseño de proceso comercial",
        "Tablero de oportunidades",
        "Diagnóstico operativo",
      ],
      draft: config(true),
      versions: [{ id: "norte-v1", number: 1, config: config(true) }],
    },
    dentalTenant(),
  ];
}
export function dentalTenant(): Tenant {
  const discovery = {
    ...structuredClone(defaultDiscovery),
    enabled: true,
    objective:
      "Comprender qué desea mejorar la persona de su sonrisa, segmentar su interés por implantes dentales o carillas y preparar una conversación de valoración con la clínica, sin recomendar un tratamiento clínico.",
    context:
      "Clínica Sonrisa es una empresa sintética para probar Discovery OS. Ofrece implantes dentales y carillas. Aún no hay precios, promociones, sede ni disponibilidad aprobados. No inventes esos datos. La conversación escucha la situación de la persona y sus prioridades antes de explorar su interés en uno o varios servicios. El siguiente paso es una valoración por el equipo de la clínica.",
    audience:
      "Personas adultas que buscan orientación sobre cómo mejorar su sonrisa o reponer piezas dentales.",
    boundaries:
      "No diagnosticar ni afirmar que la persona necesita, es apta o es candidata a un tratamiento. No pedir datos clínicos sensibles ni fotografías. Explorar solo lo que el visitante quiera compartir. La selección comercial expresa interés, no indicación médica.",
    services: [
      {
        name: "Implantes dentales",
        description:
          "Servicio de la clínica para explorar interés en reponer piezas. La idoneidad requiere valoración profesional.",
      },
      {
        name: "Carillas",
        description:
          "Servicio de la clínica para explorar interés en la apariencia de la sonrisa. La idoneidad requiere valoración profesional.",
      },
    ],
    fields: [
      {
        id: "goal",
        label: "Qué desea mejorar",
        description: "Resultado que busca la persona en sus propias palabras.",
        required: true,
      },
      {
        id: "situation",
        label: "Situación actual",
        description:
          "Qué le preocupa de su sonrisa y cómo le afecta, sin pedir historial médico.",
        required: true,
      },
      {
        id: "priority",
        label: "Prioridad",
        description:
          "Qué aspecto importa más y si expresa interés por uno o varios servicios.",
        required: true,
      },
      {
        id: "obstacle",
        label: "Dudas y frenos",
        description:
          "Dudas sobre el proceso, expectativas o barreras expresadas.",
        required: true,
      },
      {
        id: "timing",
        label: "Momento para avanzar",
        description: "Cuándo le gustaría informarse o acudir a una valoración.",
        required: true,
      },
      {
        id: "next_step",
        label: "Siguiente paso",
        description:
          "Qué necesita conocer antes de hablar con el equipo de la clínica.",
        required: false,
      },
    ],
    maxTurns: 10,
  };
  const template: Config = {
    title: "Conversemos sobre tu sonrisa",
    description:
      "Cuéntanos qué te gustaría mejorar. Te haremos preguntas según tus respuestas para entender tu interés y preparar una valoración con el equipo.",
    questions: config().questions,
    discovery,
  };
  return {
    id: "dental",
    slug: "sonrisa",
    name: "Clínica Sonrisa",
    color: "#137c73",
    industry: "Odontología · ejemplo de configuración",
    cta: "Preparar una valoración con la clínica",
    services: ["Implantes dentales", "Carillas", "Valoración odontológica"],
    draft: structuredClone(template),
    versions: [
      { id: "dental-v1", number: 1, config: structuredClone(template) },
    ],
  };
}
