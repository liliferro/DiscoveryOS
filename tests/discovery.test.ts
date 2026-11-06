import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDiscovery,
  validateDecision,
  discoverySchema,
  type Conversation,
  type Decision,
  expandDecisionProfile,
} from "../lib/discovery.ts";
import {
  encryptSecret,
  decryptSecret,
  connectionView,
} from "../lib/ai-settings.ts";
import { generateDecision } from "../lib/ai-provider.ts";
import { claudeSchema } from "../lib/claude-provider.ts";
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
  const unsupportedDecline = decision(1);
  unsupportedDecline.profile[0] = {
    ...unsupportedDecline.profile[0],
    status: "declined",
    evidence: [],
  };
  assert.throws(
    () => validateDecision(unsupportedDecline, config, 1, []),
    /UNSUPPORTED_PROFILE/,
  );
  const duplicateOptions = decision(1);
  duplicateOptions.nextQuestion!.options = [
    "Conocer opciones",
    "conocer opciones",
  ];
  assert.throws(
    () => validateDecision(duplicateOptions, config, 1, []),
    /INVALID_OPTIONS/,
  );
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
              reason: "Servicio demo",
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
test("El perfil incremental conserva evidencia, admite correcciones y rechaza campos o cierres inventados", () => {
  const prior = decision(1).profile;
  const patch = {
    ...decision(2),
    profile: [{ ...prior[0], value: "Objetivo corregido", evidence: [2] }],
  };
  const expanded = expandDecisionProfile(patch, config, prior);
  assert.equal(expanded.profile[0].value, "Objetivo corregido");
  assert.deepEqual(expanded.profile[1], prior[1]);
  assert.equal(
    validateDecision(expanded, config, 2, []).profile.length,
    config.fields.length,
  );
  for (const profile of [
    [...patch.profile, ...patch.profile],
    [{ ...prior[0], fieldId: "inventado" }],
  ])
    assert.throws(
      () => expandDecisionProfile({ ...patch, profile }, config, prior),
      /AI_INVALID_PROFILE/,
    );
  const cleared = expandDecisionProfile(
    {
      ...patch,
      profile: [{ ...prior[0], status: "unknown", value: "", evidence: [] }],
    },
    config,
    prior,
  );
  assert.equal(cleared.profile[0].status, "unknown");
  assert.throws(
    () =>
      validateDecision(
        { ...cleared, nextQuestion: null },
        config,
        config.minTurns,
        [],
      ),
    /INCOMPLETE_PROFILE/,
  );
  const noPrior = expandDecisionProfile({ ...decision(), profile: [] }, config);
  assert.ok(
    noPrior.profile.every(
      (field) => field.status === "unknown" && !field.evidence.length,
    ),
  );
  assert.throws(
    () =>
      validateDecision(
        expandDecisionProfile(
          { ...patch, profile: [{ ...prior[0], evidence: [9] }] },
          config,
          prior,
        ),
        config,
        2,
        [],
      ),
    /INVALID_EVIDENCE/,
  );
});

test("Haiku usa generación sin thinking, perfil compacto y contexto de empresa cacheable", async () => {
  const conversation: Conversation = {
    revision: 0,
    turns: [],
    closed: false,
    provider: "anthropic",
    usage: [],
    calls: 0,
    noticeVersion: "test",
    consentedAt: "",
  };
  const connection = {
    provider: "anthropic" as const,
    model: "claude-haiku-5-5",
    cipher: encryptSecret("sk-prueba-ficticia"),
    enabled: true,
    verified: false,
    dailyLimit: 100,
  };
  const fetcher: typeof fetch = async (input, init) => {
    const body = await new Request(input, init).json();
    assert.equal(body.output_config.effort, "low");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.system[0].cache_control.type, "ephemeral");
    assert.match(body.system[0].text, /SOLO los campos nuevos o modificados/);
    assert.equal(JSON.parse(body.messages[0].content).answeredCount, 0);
    return Response.json({
      id: "msg_haiku_compact",
      type: "message",
      role: "assistant",
      model: connection.model,
      stop_reason: "end_turn",
      content: [
        { type: "text", text: JSON.stringify({ ...decision(), profile: [] }) },
      ],
      usage: { input_tokens: 30, output_tokens: 40 },
    });
  };
  const result = await generateDecision(
    config,
    conversation,
    connection,
    fetcher,
  );
  assert.equal(result.attempts, 1);
  assert.equal(result.decision.profile.length, config.fields.length);
  assert.equal(result.usage.model, connection.model);
  assert.ok(result.usage.durationMs >= 0);
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
    const context = JSON.parse(body.input[0].content);
    assert.match(context.dentalMap.patientReported, /11/);
    assert.match(context.dentalMap.instruction, /no diagnóstico/);
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
  const result = await generateDecision(
    config,
    c,
    connection,
    fetcher,
    undefined,
    "Pieza 11 ausente, según la persona.",
  );
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
test("Claude usa Messages y adapta el schema sin omitir la validación local", async (t) => {
  const previousWorkspace = process.env.ANTHROPIC_WORKSPACE_ID;
  process.env.ANTHROPIC_WORKSPACE_ID = "wrkspc_test";
  t.after(() => {
    if (previousWorkspace === undefined)
      delete process.env.ANTHROPIC_WORKSPACE_ID;
    else process.env.ANTHROPIC_WORKSPACE_ID = previousWorkspace;
  });
  const c: Conversation = {
    revision: 0,
    turns: [],
    closed: false,
    provider: "anthropic",
    usage: [],
    calls: 0,
    noticeVersion: "test",
    consentedAt: "",
  };
  let called = false;
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.url, "https://api.anthropic.com/v1/messages");
    assert.equal(request.headers.get("anthropic-workspace-id"), "wrkspc_test");
    const body = await request.json();
    assert.equal(body.output_config.format.type, "json_schema");
    assert.equal(body.output_config.effort, "medium");
    assert.match(
      JSON.parse(body.messages[0].content).dentalMap.patientReported,
      /11/,
    );
    assert.equal(
      body.output_config.format.schema.properties.summary.maxLength,
      undefined,
    );
    assert.ok(body.output_config.format.schema.properties.summary.description);
    called = true;
    return Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(decision()) }],
      usage: { input_tokens: 30, output_tokens: 40 },
    });
  };
  const result = await generateDecision(
    config,
    c,
    {
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      cipher: encryptSecret("sk-clave-ficticia-unitaria"),
      enabled: true,
      verified: false,
      dailyLimit: 100,
    },
    fetcher,
    undefined,
    "Pieza 11 ausente, según la persona.",
  );
  assert.equal(called, true);
  assert.equal(result.usage.model, "claude-sonnet-5-5");
  assert.deepEqual(claudeSchema({ type: "integer", minimum: 1 }), {
    type: "integer",
    description: "minimum: 1",
  });
});
