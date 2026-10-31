import type { Answers, Report, Source, Tenant } from "./domain.ts";
import { scoreAnswers } from "./domain.ts";
export interface ResearchProvider {
  extract(answers: Answers): Source[];
}
export interface DiagnosticProvider {
  generate(answers: Answers, tenant: Tenant, sources: Source[]): Report;
}
export const researchProvider: ResearchProvider = {
  extract: () => [
    {
      id: "fixture-1",
      title: "Fixture de investigación · ejemplo sintético",
      excerpt:
        "Ejemplo didáctico: una página de servicios puede beneficiarse de una propuesta de valor clara y un siguiente paso visible.",
      simulated: true,
    },
  ],
};
export const diagnosticProvider: DiagnosticProvider = {
  generate: (answers, tenant, sources) => {
    const scoring = scoreAnswers(answers);
    const services: string[] = [];
    if (answers.measurement === false) services.push(tenant.services[1]);
    if (answers.process === false) services.push(tenant.services[0]);
    return {
      summary: `${String(answers.company || "Tu empresa")} busca ${String(answers.goal || "mejorar sus resultados").toLowerCase()}. Esta lectura utiliza tus respuestas y ejemplos sintéticos; no se ha visitado tu sitio ni consultado una IA.`,
      ...scoring,
      findings: [
        {
          title: "El objetivo está definido",
          detail: String(answers.goal),
          provenance: "Declarado por el participante",
        },
        {
          title: answers.measurement
            ? "Existe una base de medición"
            : "Oportunidad de mejorar la medición",
          detail: answers.measurement
            ? "Indicas que mides los resultados. Conviene revisar qué decisiones permiten tomar."
            : "Indicas que aún no mides los resultados. Definir una línea base es un primer paso útil.",
          provenance: "Interpretación de respuestas",
        },
        {
          title: "Ejemplo de revisión de presencia digital",
          detail:
            "Este hallazgo ilustra cómo se mostrará una evidencia. No describe tu sitio web.",
          provenance: "Simulación · no verificado",
          sourceId: sources[0]?.id,
        },
      ],
      actions: [
        {
          day: 30,
          text: "Definir un objetivo medible y registrar la situación inicial.",
        },
        {
          day: 60,
          text: "Probar una mejora acotada del proceso y documentar resultados.",
        },
        { day: 90, text: "Comparar con la línea base y decidir qué mantener." },
      ],
      services: [...new Set(services)],
      sources,
      tenantName: tenant.name,
      cta: tenant.cta,
      model: "mock-diagnostic-v1",
    };
  },
};
