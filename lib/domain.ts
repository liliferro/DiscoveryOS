import { z } from "zod";
import { discoverySchema, type Conversation } from "./discovery.ts";
export const questionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .max(60),
  label: z.string().min(2).max(200),
  type: z.enum(["text", "single", "multiple", "number", "url", "boolean"]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(100)).max(20).optional(),
  visibleIf: z
    .object({
      questionId: z.string(),
      value: z.union([z.string(), z.boolean()]),
    })
    .optional(),
});
export const configSchema = z.object({
  ctaLabel: z.string().trim().min(2).max(100).optional(),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  title: z.string().min(3).max(120),
  description: z.string().max(500),
  bookingUrl: z
    .string()
    .max(2000)
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Usa un enlace HTTPS válido para agendar")
    .optional(),
  questions: z.array(questionSchema).min(1).max(30),
  discovery: discoverySchema.optional(),
  mode: z.enum(["fixed", "adaptive"]).optional(),
});
export type Config = z.infer<typeof configSchema>;
export type Question = Config["questions"][number];
export type Answers = Record<string, string | number | boolean | string[]>;
export type Tenant = {
  clientId?: string;
  landingName?: string;
  published?: boolean;
  logoUrl?: string;
  id: string;
  name: string;
  slug: string;
  color: string;
  industry: string;
  cta: string;
  services: string[];
  draft: Config;
  versions: { id: string; number: number; config: Config }[];
};
export type Source = {
  id: string;
  title: string;
  excerpt: string;
  simulated: true;
};
export type Report = {
  summary: string;
  score: number | null;
  coverage: number;
  findings: {
    title: string;
    detail: string;
    provenance: string;
    sourceId?: string;
  }[];
  actions: { day: number; text: string }[];
  services: string[];
  sources: Source[];
  tenantName: string;
  cta: string;
  model: string;
};
export type Run = {
  id: string;
  tenantId: string;
  brand: { name: string; color: string; logoUrl?: string; industry?: string };
  versionId: string;
  version: number;
  config: Config;
  answers: Answers;
  tokenHash: string;
  expiresAt: number;
  createdAt: string;
  state: "draft" | "processing" | "completed_limited" | "failed";
  privacy: boolean;
  marketing: boolean;
  submittedAt?: string;
  conversation?: Conversation;
  contactRequired?: boolean;
  contact?: {
    name: string;
    whatsapp: string;
    email: string;
    consentedAt: string;
    noticeVersion: string;
  };
  patientResult?: {
    createdAt: string;
    status: "ready_for_review";
    options: { service: string; reason: string }[];
    bookingUrl: string;
  };
  report?: Report;
  job?: {
    stage: number;
    attempts: number;
    nextAt: number;
    error?: string;
    scenario: "normal" | "timeout" | "unavailable";
    sources: Source[];
    score?: { score: number | null; coverage: number };
  };
};
export const stages = [
  "Validar respuestas",
  "Investigar · simulación",
  "Calcular indicadores",
  "Preparar diagnóstico · simulación",
  "Verificar y publicar",
];
export function validateConfig(input: unknown): Config {
  const config = configSchema.parse(input);
  const seen = new Set<string>();
  for (const q of config.questions) {
    if (seen.has(q.id)) throw Error("Los identificadores deben ser únicos");
    if (q.visibleIf && !seen.has(q.visibleIf.questionId))
      throw Error("Una condición debe referirse a una pregunta anterior");
    if (
      ["single", "multiple"].includes(q.type) &&
      (!q.options?.length || new Set(q.options).size !== q.options.length)
    )
      throw Error("Incluye opciones únicas");
    seen.add(q.id);
  }
  return config;
}
export function visibleAnswers(config: Config, answers: Answers): Answers {
  const result: Answers = {};
  for (const q of config.questions) {
    if (q.visibleIf && result[q.visibleIf.questionId] !== q.visibleIf.value)
      continue;
    if (answers[q.id] !== undefined) result[q.id] = answers[q.id];
  }
  return result;
}
export function validateAnswers(
  config: Config,
  input: unknown,
  final = false,
): Answers {
  const answers = visibleAnswers(
    config,
    z
      .record(
        z.string(),
        z.union([
          z.string().max(3000),
          z.number().finite(),
          z.boolean(),
          z.array(z.string().max(100)).max(20),
        ]),
      )
      .parse(input),
  );
  for (const q of config.questions) {
    if (q.visibleIf && answers[q.visibleIf.questionId] !== q.visibleIf.value)
      continue;
    const v = answers[q.id];
    const empty =
      v === undefined || v === "" || (Array.isArray(v) && !v.length);
    if (empty) {
      if (final && q.required) throw Error(`Responde: ${q.label}`);
      continue;
    }
    if (
      (q.type === "boolean" && typeof v !== "boolean") ||
      (q.type === "number" && typeof v !== "number") ||
      (["text", "url", "single"].includes(q.type) && typeof v !== "string") ||
      (q.type === "multiple" && !Array.isArray(v))
    )
      throw Error(`Formato inválido: ${q.label}`);
    if (
      (q.type === "single" && !q.options?.includes(v as string)) ||
      (q.type === "multiple" &&
        (v as string[]).some((x) => !q.options?.includes(x)))
    )
      throw Error(`Opción inválida: ${q.label}`);
    if (q.type === "url") {
      const url = new URL(String(v));
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw Error("URL no válida");
    }
  }
  return answers;
}
// Tres señales declaradas de igual peso. Son una hipótesis de demostración.
export function scoreAnswers(answers: Answers) {
  const keys = ["has_site", "measurement", "process"];
  const known = keys.filter((k) => typeof answers[k] === "boolean");
  const coverage = Math.round((known.length / keys.length) * 100);
  return {
    score:
      coverage < 60
        ? null
        : Math.round(
            (known.reduce((n, k) => n + (answers[k] === true ? 1 : 0), 0) /
              known.length) *
              100,
          ),
    coverage,
  };
}
