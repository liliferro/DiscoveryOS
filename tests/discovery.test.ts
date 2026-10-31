import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDiscovery,
  validateDecision,
  discoverySchema,
  type Conversation,
  type Decision,
} from "../lib/discovery.ts";
import {
  encryptSecret,
  decryptSecret,
  connectionView,
} from "../lib/ai-settings.ts";
import { generateDecision } from "../lib/ai-provider.ts";
const config = { ...structuredClone(defaultDiscovery), enabled: true };
function decision(answered = 0): Decision {
  return {
    insight: "Comprendo tu situación.",
    profile: config.fields.map((f) => ({
      fieldId: f.id,
      status: answered ? "known" : "unknown",
      value: answered ? "Declarado" : "",
      evidence: answered ? [1] : [],
    })),
    segments: [],
    nextQuestion: {
      text: "¿Qué objetivo te gustaría alcanzar y por qué ahora?",
      why: "Comprender tu prioridad.",
      fieldId: "goal",
      options: [],
    },
    summary: "",
    nextSteps: [],
    handoff: false,
  };
}
test("No cierra antes del mínimo ni inventa evidencia o servicios", () => {
  assert.throws(
    () =>
      validateDecision({ ...decision(), nextQuestion: null }, config, 0, []),
    /EARLY_CLOSE/,
  );
  const invalid = decision(1);
  invalid.profile[0].evidence = [2];
  assert.throws(
    () => validateDecision(invalid, config, 1, []),
    /INVALID_EVIDENCE/,
  );
  assert.throws(
    () =>
      validateDecision(
        {
          ...decision(1),
          segments: [
            {
              service: "No existe",
              interest: "possible",
              reason: "Demo",
              evidence: [1],
            },
          ],
        },
        config,
        1,
        [],
      ),
    /INVALID_SERVICE/,
  );
});
test("Rechaza preguntas repetidas y cierra al máximo con resumen", () => {
  const d = decision(1);
  assert.throws(
    () => validateDecision(d, config, 1, [d.nextQuestion!.text]),
    /REPEATED_QUESTION/,
  );
  assert.throws(
    () => validateDecision(d, config, config.maxTurns, []),
    /INCOMPLETE_SUMMARY/,
  );
  const final = validateDecision(
    {
      ...d,
      summary: "Resumen con límites",
      nextSteps: ["Conversar con el equipo."],
    },
    config,
    config.maxTurns,
    [],
  );
  assert.equal(final.nextQuestion, null);
});
test("Valida los límites y admite una negativa explícita sin inventar perfil", () => {
  assert.equal(
    discoverySchema.safeParse({ ...config, minTurns: 8, maxTurns: 4 }).success,
    false,
  );
  const d = decision(1);
  d.profile[0] = {
    fieldId: "goal",
    value: "Prefiere no compartirlo",
    status: "declined",
    evidence: [1],
  };
  assert.equal(
    validateDecision(d, config, 1, []).profile[0].status,
    "declined",
  );
});
test("Cifra la clave y solo expone estado de conexión", () => {
  const key = "sk-prueba-unitaria-sin-valor-real";
  const cipher = encryptSecret(key);
  assert.notEqual(cipher, key);
  assert.equal(decryptSecret(cipher), key);
  assert.equal(
    JSON.stringify(
      connectionView({
        cipher,
        model: "gpt-6.1-terra",
        enabled: true,
        verified: false,
        dailyLimit: 100,
      }),
    ).includes(key),
    false,
  );
});
test("El adaptador envía Structured Outputs y reintenta JSON inválido una vez", async () => {
  const c: Conversation = {
    revision: 0,
    turns: [],
    closed: false,
    provider: "openai",
    usage: [],
    calls: 0,
    noticeVersion: "test",
    consentedAt: new Date().toISOString(),
  };
  let calls = 0;
  const connection = {
    cipher: encryptSecret("sk-clave-ficticia-para-unit-test"),
    model: "gpt-6.1-terra",
    enabled: true,
    verified: false,
    dailyLimit: 100,
  };
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    return Response.json({
      id: "resp_test",
      model: connection.model,
      status: "completed",
      usage: { input_tokens: 40, output_tokens: 25 },
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: calls === 1 ? "{}" : JSON.stringify(decision()),
            },
          ],
        },
      ],
    });
  };
  const result = await generateDecision(config, c, connection, fetcher);
  assert.equal(calls, 2);
  assert.equal(result.decision.nextQuestion?.fieldId, "goal");
  assert.equal(result.usage.inputTokens, 40);
});
test("No sustituye una denegación por un resultado simulado", async () => {
  const c: Conversation = {
    revision: 0,
    turns: [],
    closed: false,
    provider: "openai",
    usage: [],
    calls: 0,
    noticeVersion: "test",
    consentedAt: "",
  };
  await assert.rejects(
    () =>
      generateDecision(
        config,
        c,
        {
          cipher: encryptSecret("sk-clave-unitaria-sin-valor"),
          model: "gpt-6.1-terra",
          enabled: true,
          verified: false,
          dailyLimit: 10,
        },
        async () => new Response("", { status: 401 }),
      ),
    /clave no está autorizada/,
  );
});
