import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "./store.ts";
import {
  defaultConnection,
  connectionView,
  testFixtureEnabled,
} from "./ai-settings.ts";
import { DiscoveryError, generateDecision } from "./ai-provider.ts";
import type { Run } from "./domain.ts";
import { landingFacts } from "./discovery-facts.ts";
import { preparePatientResult } from "./patient-result.ts";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const bodySchema = z.object({
  revision: z.number().int().min(0),
  operationId: z.string().uuid(),
  index: z.number().int().min(0).max(11).optional(),
  answer: z.string().trim().min(1).max(2500).optional(),
  privacy: z.boolean().optional(),
});
export function publicConfig(config: Run["config"], brand?: Run["brand"]) {
  const { discovery, ...rest } = config;
  return discovery?.enabled
    ? {
        title: config.title,
        loadingFacts: landingFacts(config, brand),
        description: config.description,
        ctaLabel: config.ctaLabel,
        contactEmail: config.contactEmail,
        questions: [],
        bookingUrl: config.bookingUrl,
        mode: "adaptive" as const,
      }
    : { ...rest, mode: "fixed" as const };
}
export function publicRun(run: Run, internal = false) {
  const safe = { ...run } as Partial<Run>;
  delete safe.tokenHash;
  safe.config = publicConfig(run.config, run.brand);
  if (safe.state !== "completed_limited") delete safe.report;
  if (safe.conversation) {
    const { lease, lastOperation, ...conversation } = safe.conversation;
    void lease;
    void lastOperation;
    safe.conversation = conversation;
    if (!internal) {
      const publicDecision = (
        decision: NonNullable<Run["conversation"]>["decision"],
      ) => (decision ? { ...decision, profile: [], summary: "" } : undefined);
      safe.conversation = {
        ...conversation,
        usage: [],
        calls: 0,
        error: conversation.error
          ? "No pudimos preparar la respuesta. Puedes reintentar o contactar al equipo."
          : undefined,
        decision: publicDecision(conversation.decision),
        turns: conversation.turns.map((turn) => ({
          ...turn,
          decision: publicDecision(turn.decision),
        })),
      };
    }
  }
  return safe;
}
export async function advanceConversation(
  runId: string,
  credential: string,
  input: unknown,
) {
  const body = bodySchema.parse(input);
  const bodyHash = hash(JSON.stringify(body));
  const lockId = randomUUID();
  const prepared = await transaction((state) => {
    const run = state.runs.find(
      (r) =>
        r.id === runId &&
        r.expiresAt > Date.now() &&
        r.tokenHash === hash(credential),
    );
    if (!run || state.tenants.find((t) => t.id === run.tenantId)?.deletedAt)
      throw new DiscoveryError(
        404,
        "Ejecución no disponible o acceso caducado.",
      );
    const config = run.config.discovery;
    if (!config?.enabled)
      throw new DiscoveryError(
        409,
        "Esta sesión utiliza preguntas predefinidas.",
      );
    if (run.contactRequired && !run.contact)
      throw new DiscoveryError(
        422,
        "Completa tus datos de contacto antes de comenzar la conversación.",
      );
    const connection =
      state.aiConnections?.[run.tenantId] || defaultConnection();
    if (!connection.enabled || !connectionView(connection).configured)
      throw new DiscoveryError(
        503,
        "La empresa debe conectar y activar su proveedor de IA para iniciar esta conversación.",
      );
    let c = run.conversation;
    if (c?.lastOperation?.id === body.operationId) {
      if (c.lastOperation.hash !== bodyHash)
        throw new DiscoveryError(
          409,
          "La operación ya se utilizó con otra respuesta.",
        );
      return { replay: publicRun(run) };
    }
    if (c?.lease && c.lease.until > Date.now())
      throw new DiscoveryError(
        409,
        "Hay una respuesta en preparación. Espera unos segundos y reintenta.",
      );
    if ((c?.revision || 0) !== body.revision)
      throw new DiscoveryError(
        409,
        "La conversación cambió. Recarga para continuar con la última versión.",
      );
    if (!c) {
      if (body.privacy !== true)
        throw new DiscoveryError(
          422,
          "Acepta el uso de tus respuestas con IA para continuar.",
        );
      c = run.conversation = {
        revision: 0,
        turns: [],
        closed: false,
        provider: testFixtureEnabled()
          ? "fixture"
          : connection.provider || "openai",
        usage: [],
        calls: 0,
        noticeVersion: "adaptive-local-v1",
        consentedAt: new Date().toISOString(),
      };
      run.privacy = true;
    }
    if (c.closed)
      throw new DiscoveryError(409, "Esta conversación ya finalizó.");
    state.aiDaily ||= {};
    const dayKey = run.tenantId + ":" + new Date().toISOString().slice(0, 10);
    const count = state.aiDaily[dayKey] || 0;
    if (count + 2 > connection.dailyLimit || c.calls >= config.maxTurns * 4 + 4)
      throw new DiscoveryError(
        429,
        "Se alcanzó el límite de llamadas de IA. Contacta con la empresa.",
      );
    if (body.answer !== undefined) {
      if (body.index === undefined || !c.turns[body.index])
        throw new DiscoveryError(422, "Pregunta no disponible.");
      c.turns = c.turns.slice(0, body.index + 1);
      c.turns[body.index].answer = body.answer;
      c.turns[body.index].decision = undefined;
      c.decision =
        body.index > 0 ? c.turns[body.index - 1].decision : undefined;
    } else if (c.turns.length && c.turns.at(-1)?.answer === undefined)
      return { replay: publicRun(run) };
    c.lease = { id: lockId, until: Date.now() + 65000 };
    c.provider = testFixtureEnabled()
      ? "fixture"
      : connection.provider || "openai";
    c.error = undefined;
    c.calls += 2;
    state.aiDaily[dayKey] = count + 2;
    return {
      run: structuredClone(run),
      connection: structuredClone(connection),
      config: structuredClone(config),
    };
  });
  if (prepared.replay) return prepared.replay;
  const { run, config, connection } = prepared;
  if (!run || !config || !connection)
    throw new DiscoveryError(500, "No se pudo preparar la conversación.");
  try {
    const result = testFixtureEnabled()
      ? await fixture(config, run.conversation!)
      : await generateDecision(
          config,
          run.conversation!,
          connection,
          fetch,
          async (usage) => {
            await transaction((state) => {
              const c = state.runs.find((r) => r.id === runId)?.conversation;
              if (c?.lease?.id === lockId) c.usage.push(usage);
            });
          },
        );
    return await transaction((state) => {
      const live = state.runs.find((r) => r.id === runId)!;
      if (state.tenants.find((t) => t.id === live.tenantId)?.deletedAt)
        throw new DiscoveryError(404, "Esta landing ya no está disponible.");
      const c = live.conversation!;
      if (c.lease?.id !== lockId)
        throw new DiscoveryError(
          409,
          "Este intento caducó. Recarga para recuperar el estado actual.",
        );
      if (!c.usage.some((u) => u.responseId === result.usage.responseId))
        c.usage.push(result.usage);
      c.decision = result.decision;
      const last = c.turns.at(-1);
      if (last?.answer !== undefined) last.decision = result.decision;
      if (result.decision.nextQuestion) {
        c.turns.push({
          id: randomUUID(),
          question: result.decision.nextQuestion,
        });
      } else {
        c.closed = true;
        live.state = "completed_limited";
        live.submittedAt = new Date().toISOString();
        preparePatientResult(live);
      }
      c.revision++;
      c.lastOperation = { id: body.operationId, hash: bodyHash };
      delete c.lease;
      return publicRun(live);
    });
  } catch (e) {
    await transaction((state) => {
      const c = state.runs.find((r) => r.id === runId)?.conversation;
      if (c?.lease?.id === lockId) {
        delete c.lease;
        c.error =
          e instanceof DiscoveryError
            ? e.message
            : "La IA no pudo completar la respuesta. Reintenta.";
      }
    });
    if (e instanceof DiscoveryError) throw e;
    throw new DiscoveryError(
      502,
      "La IA no pudo completar la respuesta. Tus respuestas siguen guardadas.",
    );
  }
}
// Doble de prueba explícito, habilitado solo por la configuración del runner E2E.
async function fixture(
  config: NonNullable<Run["config"]["discovery"]>,
  c: NonNullable<Run["conversation"]>,
) {
  const n = c.turns.filter((t) => t.answer !== undefined).length;
  const last = c.turns.at(-1)?.answer || "";
  const implant = c.turns.some((t) =>
    /falta|perd|implante/i.test(t.answer || ""),
  );
  const service =
    config.services.find((s) =>
      implant ? /implante/i.test(s.name) : /carilla/i.test(s.name),
    ) || config.services[0];
  const field = config.fields[Math.min(n, config.fields.length - 1)];
  const question = {
    text: n
      ? `Mencionaste «${last.slice(0, 65)}». ¿Qué te gustaría aclarar sobre ${field.label.toLowerCase()}?`
      : "¿Qué te gustaría mejorar de tu sonrisa y qué te motivó a buscar opciones?",
    why: "Entender tus prioridades antes de explorar servicios.",
    fieldId: field.id,
    options: [],
  };
  const decision = {
    insight: n ? `Entiendo que ${last}.` : "Vamos a escuchar lo que necesitas.",
    profile: config.fields.map((f, i) => ({
      fieldId: f.id,
      value: i < n ? c.turns[i].answer || "" : "",
      status: i < n ? ("known" as const) : ("unknown" as const),
      evidence: i < n ? [i + 1] : [],
    })),
    segments: n
      ? [
          {
            service: service.name,
            interest: "possible" as const,
            reason: "Interés de ejemplo basado en la conversación.",
            evidence: [1],
          },
        ]
      : [],
    nextQuestion: n >= config.maxTurns ? null : question,
    summary:
      n >= config.maxTurns
        ? "Resumen de prueba de la conversación. La valoración corresponde al equipo."
        : "",
    nextSteps:
      n >= config.maxTurns ? ["Hablar con el equipo para una valoración."] : [],
    handoff: false,
  };
  return {
    decision,
    usage: {
      model: "fixture-adaptive-v1",
      responseId: randomUUID(),
      inputTokens: 0,
      outputTokens: 0,
      at: new Date().toISOString(),
    },
    attempts: 1,
  };
}
