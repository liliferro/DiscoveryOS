import { test, expect } from "@playwright/test";
import { defaultDiscovery } from "../../lib/discovery";

test("API: permisos, origen, JSON inválido, límites y configuración extensa", async ({
  request,
}) => {
  expect((await request.get("/api/v1/admin/dashboard")).status()).toBe(401);
  expect((await request.get("/api/v1/agency/export")).status()).toBe(401);
  const crossOrigin = await request.post("/api/v1/login", {
    headers: { Origin: "https://untrusted.example" },
    data: { tenantId: "mood", password: "discovery-demo" },
  });
  expect(crossOrigin.status()).toBe(403);
  for (const body of ["null", "[]", "{broken"]) {
    const response = await request.post("/api/v1/login", {
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).message).not.toContain("TypeError");
  }
  expect(
    (
      await request.post("/api/v1/public/runs", {
        data: { slug: "x".repeat(65000) },
      })
    ).status(),
  ).toBe(413);
  await request.post("/api/v1/login", {
    data: { tenantId: "mood", password: "discovery-demo" },
  });
  const original = (await (await request.get("/api/v1/admin/dashboard")).json())
    .tenant.draft;
  const extensive = {
    ...original,
    discovery: {
      ...defaultDiscovery,
      enabled: true,
      context: "Contexto de prueba. ".repeat(600).slice(0, 12000),
      services: Array.from({ length: 12 }, (_, i) => ({
        name: `Servicio ${i}`,
        description: "Descripción. ".repeat(125).slice(0, 1500),
      })),
      fields: Array.from({ length: 12 }, (_, i) => ({
        id: `field_${i}`,
        label: `Campo ${i}`,
        description: "Información. ".repeat(70).slice(0, 800),
        required: true,
      })),
    },
    loadingFacts: Array.from({ length: 60 }, (_, i) => ({
      topic: `Tema ${i}`,
      text: "Dato de prueba. ".repeat(30).slice(0, 400),
      source: "Empresa de prueba",
      url: "",
    })),
  };
  expect(Buffer.byteLength(JSON.stringify(extensive))).toBeGreaterThan(64000);
  try {
    expect(
      (
        await request.put("/api/v1/admin/template", { data: extensive })
      ).status(),
    ).toBe(200);
    const saved = (await (await request.get("/api/v1/admin/dashboard")).json())
      .tenant.draft;
    expect(saved.loadingFacts).toHaveLength(60);
  } finally {
    await request.put("/api/v1/admin/template", { data: original });
  }
  const connection = {
    provider: "openai",
    model: "gpt-6.1-terra",
    enabled: false,
    dailyLimit: 100,
    apiKey: "sk-synthetic-audit-key-never-real",
  };
  expect(
    (
      await request.put("/api/v1/admin/connection", { data: connection })
    ).status(),
  ).toBe(200);
  const { apiKey, ...changeProvider } = connection;
  expect(apiKey).toBeTruthy();
  expect(
    (
      await request.put("/api/v1/admin/connection", {
        data: {
          ...changeProvider,
          provider: "anthropic",
          model: "claude-sonnet-5-5",
        },
      })
    ).status(),
  ).toBe(422);
  const logout = await request.post("/api/v1/logout", { data: {} });
  expect(
    logout
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)
      .join(";"),
  ).toContain("discovery_auth=");
  expect((await request.get("/api/v1/admin/dashboard")).status()).toBe(401);
});
