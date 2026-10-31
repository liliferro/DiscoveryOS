import { z } from "zod";
export const discoverySchema = z
  .object({
    enabled: z.boolean(),
    objective: z.string().min(10).max(2500),
    context: z.string().min(20).max(12000),
    audience: z.string().min(3).max(1000),
    tone: z.string().min(3).max(500),
    boundaries: z.string().max(3000),
    services: z
      .array(
        z.object({
          name: z.string().min(2).max(120),
          description: z.string().min(5).max(1500),
        }),
      )
      .min(1)
      .max(12),
    fields: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z][a-z0-9_]*$/),
          label: z.string().min(2).max(100),
          description: z.string().min(5).max(800),
          required: z.boolean(),
        }),
      )
      .min(2)
      .max(12),
    minTurns: z.number().int().min(2).max(8),
    maxTurns: z.number().int().min(4).max(12),
  })
  .superRefine((v, ctx) => {
    if (v.minTurns > v.maxTurns)
      ctx.addIssue({
        code: "custom",
        message: "El mínimo no puede superar el máximo",
      });
    for (const list of [
      v.fields.map((f) => f.id),
      v.services.map((s) => s.name),
    ])
      if (new Set(list).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Campos y servicios deben tener identificadores únicos",
        });
  });
export type DiscoveryConfig = z.infer<typeof discoverySchema>;
export const questionOutput = z.object({
  text: z.string().min(8).max(400),
  why: z.string().min(5).max(400),
  fieldId: z.string(),
  options: z.array(z.string().min(1).max(180)).max(5),
});
export const decisionSchema = z.object({
  insight: z.string().max(700),
  profile: z
    .array(
      z.object({
        fieldId: z.string(),
        value: z.string().max(1200),
        status: z.enum(["known", "unknown", "declined"]),
        evidence: z.array(z.number().int().min(1)),
      }),
    )
    .max(12),
  segments: z
    .array(
      z.object({
        service: z.string(),
        interest: z.enum(["explicit", "possible", "not_interested"]),
        reason: z.string().trim().min(5).max(600),
        evidence: z.array(z.number().int().min(1)).min(1),
      }),
    )
    .max(12),
  nextQuestion: questionOutput.nullable(),
  summary: z.string().max(1800),
  nextSteps: z.array(z.string().max(500)).max(4),
  handoff: z.boolean(),
});
export type Decision = z.infer<typeof decisionSchema>;
export type Conversation = {
  revision: number;
  turns: {
    id: string;
    question: z.infer<typeof questionOutput>;
    answer?: string;
    decision?: Decision;
  }[];
  decision?: Decision;
  closed: boolean;
  provider: "openai" | "anthropic" | "fixture";
  usage: {
    model: string;
    responseId: string;
    inputTokens: number;
    outputTokens: number;
    at: string;
  }[];
  calls: number;
  lease?: { id: string; until: number };
  lastOperation?: { id: string; hash: string };
  error?: string;
  noticeVersion: string;
  consentedAt: string;
};
export const defaultDiscovery: DiscoveryConfig = {
  enabled: false,
  objective:
    "Comprender los objetivos del visitante y orientar su interés hacia el servicio adecuado, si existe encaje.",
  context:
    "La empresa quiere escuchar antes de proponer. No inventar información comercial, precios, resultados ni servicios que no aparezcan en el catálogo.",
  audience: "Personas interesadas en los servicios de la empresa.",
  tone: "Español cercano, claro y respetuoso. Una sola pregunta por turno.",
  boundaries:
    "No presionar para comprar ni inventar necesidades. Permitir que la persona no responda o no tenga interés.",
  services: [
    {
      name: "Sesión de orientación",
      description:
        "Conversación inicial para aclarar necesidades y definir próximos pasos.",
    },
  ],
  fields: [
    {
      id: "goal",
      label: "Objetivo",
      description: "Qué desea conseguir y por qué es importante.",
      required: true,
    },
    {
      id: "situation",
      label: "Situación actual",
      description:
        "Contexto concreto y experiencias previas relacionadas con su objetivo.",
      required: true,
    },
    {
      id: "obstacle",
      label: "Principal freno",
      description: "Dudas, barreras o preocupaciones que ha expresado.",
      required: true,
    },
    {
      id: "timing",
      label: "Momento",
      description:
        "Cuándo le gustaría avanzar y su preferencia de siguiente paso.",
      required: true,
    },
  ],
  minTurns: 4,
  maxTurns: 8,
};
export function validateDecision(
  value: unknown,
  config: DiscoveryConfig,
  answered: number,
  previousQuestions: string[],
): Decision {
  const d = decisionSchema.parse(value);
  const fields = new Set(config.fields.map((f) => f.id));
  if (
    d.profile.length !== fields.size ||
    new Set(d.profile.map((p) => p.fieldId)).size !== fields.size ||
    d.profile.some((p) => !fields.has(p.fieldId))
  )
    throw Error("AI_INVALID_PROFILE");
  for (const item of [...d.profile, ...d.segments]) {
    if (item.evidence.some((n) => n > answered))
      throw Error("AI_INVALID_EVIDENCE");
  }
  if (
    d.profile.some(
      (p) => p.status === "known" && (!p.value.trim() || !p.evidence.length),
    )
  )
    throw Error("AI_UNSUPPORTED_PROFILE");
  if (d.profile.some((p) => p.status === "declined" && !p.evidence.length))
    throw Error("AI_UNSUPPORTED_PROFILE");
  if (
    d.nextQuestion &&
    new Set(
      d.nextQuestion.options.map((option) =>
        option.trim().toLocaleLowerCase("es"),
      ),
    ).size !== d.nextQuestion.options.length
  )
    throw Error("AI_INVALID_OPTIONS");
  if (
    d.segments.some(
      (s) => !config.services.some((x) => x.name === s.service),
    ) ||
    new Set(d.segments.map((s) => s.service)).size !== d.segments.length
  )
    throw Error("AI_INVALID_SERVICE");
  if (
    d.nextQuestion &&
    (!fields.has(d.nextQuestion.fieldId) ||
      previousQuestions.some(
        (q) =>
          q.trim().toLowerCase() === d.nextQuestion!.text.trim().toLowerCase(),
      ))
  )
    throw Error("AI_REPEATED_QUESTION");
  if (!d.handoff && answered < config.minTurns && !d.nextQuestion)
    throw Error("AI_EARLY_CLOSE");
  if (
    !d.handoff &&
    answered < config.maxTurns &&
    !d.nextQuestion &&
    config.fields.some(
      (f) =>
        f.required &&
        d.profile.find((p) => p.fieldId === f.id)?.status === "unknown",
    )
  )
    throw Error("AI_INCOMPLETE_PROFILE");
  if (answered >= config.maxTurns || d.handoff) d.nextQuestion = null;
  if (!d.nextQuestion && (!d.summary.trim() || !d.nextSteps.length))
    throw Error("AI_INCOMPLETE_SUMMARY");
  return d;
}
