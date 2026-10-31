import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, exportLeads } from "../lib/lead-export.ts";
import type { State } from "../lib/store.ts";
import type { Run } from "../lib/domain.ts";
import { seed } from "../lib/seed.ts";

test("El CSV conserva comillas y saltos de línea y evita fórmulas en hojas de cálculo", () => {
  assert.equal(
    csvCell('Texto "citado"\ny otra línea'),
    '"Texto ""citado""\ny otra línea"',
  );
  for (const value of [
    "=SUM(1,2)",
    "+123",
    "-1+1",
    "@SUM(1)",
    "\t=2",
    "  =2",
    "\rtexto",
  ])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell("María"), '"María"');
});
test("La exportación limita las filas a la landing solicitada y omite credenciales", () => {
  const tenants = seed();
  const run: Run = {
    id: "run-uno",
    tenantId: tenants[0].id,
    brand: { name: "Empresa", color: "#6756d8" },
    versionId: tenants[0].versions[0].id,
    version: 1,
    expiresAt: Date.now() + 60000,
    privacy: true,
    marketing: false,
    config: tenants[0].draft,
    createdAt: "2026-10-30T12:00:00Z",
    state: "draft",
    answers: { goal: "=SUM(1,2)" },
    tokenHash: "credencial-privada-que-no-se-exporta",
  };
  const state: State = {
    tenants,
    runs: [run, { ...run, id: "run-dos", tenantId: tenants[1].id }],
    sessions: [],
  };
  const file = exportLeads(state, { landingId: tenants[0].id });
  assert.ok(file.csv.startsWith("\uFEFF"));
  assert.ok(file.csv.includes("run-uno"));
  assert.ok(!file.csv.includes("run-dos"));
  assert.ok(!file.csv.includes(run.tokenHash));
  assert.throws(
    () => exportLeads(state, { clientId: "inexistente" }),
    /Cliente no disponible/,
  );
  assert.throws(
    () => exportLeads(state, { landingId: "inexistente" }),
    /Landing no disponible/,
  );
});
