import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed.ts";
import {
  scoreAnswers,
  validateAnswers,
  validateConfig,
} from "../lib/domain.ts";
test("Una respuesta oculta se elimina y no se exige al enviar", () => {
  const c = seed()[0].draft;
  const a = validateAnswers(
    c,
    {
      company: "Acme demo",
      sector: "Servicios",
      has_site: false,
      website: "https://obsoleto.example",
      goal: "Atraer mejores clientes",
      channels: ["Referidos"],
      measurement: false,
      process: true,
      challenge: "Medición",
    },
    true,
  );
  assert.equal(a.website, undefined);
  assert.equal(a.has_site, false);
});
test("Un campo condicional visible es obligatorio", () => {
  assert.throws(
    () => validateAnswers(seed()[0].draft, { company: "   " }, true),
    /Responde/,
  );
  assert.throws(() =>
    validateAnswers(
      seed()[0].draft,
      { company: "Demo", sector: "Demo", has_site: true },
      true,
    ),
  );
});
test("Desconocido no equivale a cero; requiere cobertura mínima", () => {
  assert.deepEqual(scoreAnswers({}), { score: null, coverage: 0 });
  assert.deepEqual(scoreAnswers({ has_site: true }), {
    score: null,
    coverage: 33,
  });
  assert.deepEqual(scoreAnswers({ has_site: true, process: false }), {
    score: 50,
    coverage: 67,
  });
  assert.deepEqual(
    scoreAnswers({ has_site: true, process: true, measurement: true }),
    { score: 100, coverage: 100 },
  );
});
test("El constructor rechaza referencias futuras e identificadores duplicados", () => {
  const config = seed()[0].draft;
  assert.throws(() =>
    validateConfig({
      ...config,
      questions: [config.questions[3], ...config.questions],
    }),
  );
  assert.throws(() =>
    validateConfig({
      ...config,
      questions: [config.questions[0], config.questions[0]],
    }),
  );
});
test("Opciones y tipos se validan en servidor", () => {
  assert.throws(() =>
    validateAnswers(seed()[0].draft, { channels: ["No existe"] }),
  );
  assert.throws(() => validateAnswers(seed()[0].draft, { has_site: "true" }));
  assert.throws(() =>
    validateAnswers(seed()[0].draft, {
      has_site: true,
      website: "javascript:alert(1)",
    }),
  );
});
