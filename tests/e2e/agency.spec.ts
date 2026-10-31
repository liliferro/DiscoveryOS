import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Agencia: permisos, cliente con dos objetivos, publicación y sesiones independientes", async ({
  request,
}) => {
  expect((await request.get("/api/v1/agency/dashboard")).status()).toBe(401);
  expect((await request.get("/api/v1/agency/export")).status()).toBe(401);
  await request.post("/api/v1/login", {
    data: { tenantId: "norte", password: "discovery-demo" },
  });
  expect((await request.get("/api/v1/agency/dashboard")).status()).toBe(403);
  expect((await request.get("/api/v1/agency/export")).status()).toBe(403);
  expect(
    (await request.post("/api/v1/agency/clients", { data: {} })).status(),
  ).toBe(403);
  await request.post("/api/v1/login", {
    data: { tenantId: "mood", password: "discovery-demo" },
  });
  const clientData = {
    name: "Cliente sintético API",
    industry: "Servicios",
    pantone: "PANTONE 320 C",
    color: "#147d73",
    logoUrl: "https://example.com/logo.png",
    objective: "Segmentar interesados según el producto que buscan",
    context:
      "Empresa sintética dedicada a servicios para equipos. No inventar precios ni disponibilidad.",
    products: [
      {
        name: "Asesoría",
        description: "Servicio de orientación inicial para equipos.",
      },
      {
        name: "Implementación",
        description: "Acompañamiento para implementar un proyecto.",
      },
    ],
    cta: "Hablar con mi asesor",
    contactType: "whatsapp",
    contactValue: "+525500000000",
  };
  const created = await request.post("/api/v1/agency/clients", {
    data: clientData,
  });
  expect(created.status()).toBe(200);
  const client = await created.json();
  const slug = "api-" + randomUUID();
  const createLanding = (name: string, suffix: string, objective: string) =>
    request.post(`/api/v1/agency/clients/${client.id}/landings`, {
      data: {
        name,
        slug: slug + suffix,
        title: name,
        description: "Hablemos de lo que quieres lograr.",
        objective,
      },
    });
  const first = await (
    await createLanding(
      "Objetivo asesoría",
      "-a",
      "Entender el interés en recibir una asesoría inicial",
    )
  ).json();
  const second = await (
    await createLanding(
      "Objetivo implementación",
      "-b",
      "Descubrir qué necesitan implementar los equipos",
    )
  ).json();
  expect(
    (await request.get(`/api/v1/public/sessions/${slug}-a`)).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/v1/public/runs", { data: { slug: slug + "-a" } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await createLanding(
        "Enlace duplicado",
        "-a",
        "Un objetivo diferente que no debe duplicar enlaces",
      )
    ).status(),
  ).toBe(409);
  await request.post("/api/v1/agency/switch", {
    data: { landingId: first.id },
  });
  const dashboard = await (await request.get("/api/v1/admin/dashboard")).json();
  expect(dashboard.agencyAdmin).toBe(true);
  expect(dashboard.tenant.clientId).toBe(client.id);
  const config = dashboard.tenant.draft;
  config.discovery.objective =
    "Objetivo modificado solo para la primera landing";
  await request.put("/api/v1/admin/template", { data: config });
  await request.post(`/api/v1/agency/landings/${first.id}/publish`, {
    data: {},
  });
  const publicLanding = await (
    await request.get(`/api/v1/public/sessions/${slug}-a`)
  ).json();
  expect(publicLanding.logoUrl).toBe(clientData.logoUrl);
  expect(publicLanding.color).toBe(clientData.color);
  expect(publicLanding.version.config.ctaLabel).toBe(clientData.cta);
  expect(publicLanding.version.config.bookingUrl).toContain(
    "wa.me/525500000000",
  );
  expect(publicLanding.version.config.discovery).toBeUndefined();
  await request.post("/api/v1/agency/switch", {
    data: { landingId: second.id },
  });
  const secondDashboard = await (
    await request.get("/api/v1/admin/dashboard")
  ).json();
  expect(secondDashboard.tenant.draft.discovery.objective).toBe(
    "Descubrir qué necesitan implementar los equipos",
  );
  expect(
    (await request.get(`/api/v1/public/sessions/${slug}-b`)).status(),
  ).toBe(404);
  const { id: runId } = await (
    await request.post("/api/v1/public/runs", { data: { slug: slug + "-a" } })
  ).json();
  expect(
    (await (await request.get("/api/v1/admin/dashboard")).json()).runs.some(
      (r: { id: string }) => r.id === runId,
    ),
  ).toBe(false);
  const persisted = await (
    await request.get(`/api/v1/public/runs/${runId}`)
  ).json();
  expect(persisted.brand.logoUrl).toBe(clientData.logoUrl);
  const exported = await request.get(
    `/api/v1/agency/export?landingId=${first.id}`,
  );
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("text/csv");
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  expect(await exported.text()).toContain(runId);
  const emptyExport = await request.get(
    `/api/v1/agency/export?landingId=${second.id}`,
  );
  expect(await emptyExport.text()).not.toContain(runId);
  expect(
    (
      await request.put(`/api/v1/agency/clients/${client.id}`, {
        data: { ...clientData, logoUrl: "javascript:alert(1)" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.put(`/api/v1/agency/clients/${client.id}`, {
        data: { ...clientData, color: "#224466" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await request.get(`/api/v1/public/sessions/${slug}-a`)).json())
      .color,
  ).toBe("#224466");
  expect(
    (await (await request.get(`/api/v1/public/runs/${runId}`)).json()).brand
      .color,
  ).toBe(clientData.color);
  const agency = await (await request.get("/api/v1/agency/dashboard")).json();
  expect(
    agency.clients.find((c: { id: string }) => c.id === client.id).landings,
  ).toHaveLength(2);
});

test("Panel de agencia: crear cliente, crear landing, editar objetivo y publicar", async ({
  page,
}) => {
  const name = "Marca de prueba " + Date.now();
  await page.goto("/agency");
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu agencia. Todas tus marcas." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: true })
    .click();
  await page.getByLabel("Nombre del cliente", { exact: true }).fill(name);
  await page.getByLabel("Sector o industria").fill("Consultoría de prueba");
  await page.getByLabel("Referencia Pantone").fill("PANTONE 320 C");
  await page
    .getByLabel("Subir logo")
    .setInputFiles("tests/fixtures/agency-logo.png");
  await expect(
    page.getByRole("img", { name: "Vista previa del logo" }),
  ).toHaveAttribute("src", /^data:image\/webp;base64,/);
  await page
    .getByLabel("Objetivo general del cliente")
    .fill("Entender necesidades y generar prospectos para asesoría");
  await page.getByLabel("Producto o servicio 1").fill("Asesoría inicial");
  await page
    .getByLabel("Descripción 1", { exact: true })
    .fill("Conversación inicial para comprender necesidades del equipo.");
  await page.getByLabel("WhatsApp con código de país").fill("+525500000000");
  await page
    .getByRole("button", { name: "Guardar cliente", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Nueva landing", exact: true })
    .click();
  await page
    .getByLabel("Nombre interno de la landing")
    .fill("Captación para asesoría");
  await page
    .getByLabel("Objetivo de esta landing")
    .fill("Comprender qué asesoría necesita cada equipo y sus plazos");
  await page
    .getByRole("button", { name: "Crear landing", exact: true })
    .click();
  await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Editar conversación", exact: true })
    .click();
  await expect(page.getByLabel("Objetivo del discovery")).toHaveValue(
    "Comprender qué asesoría necesita cada equipo y sus plazos",
  );
  await page
    .getByRole("button", { name: "Agencia · Clientes", exact: true })
    .click();
  await page.locator(".agency-client-card").filter({ hasText: name }).click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicada", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Exportar resultados del cliente",
      exact: true,
    })
    .click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "discovery-resultados.csv",
  );
  await expect(
    page.getByRole("link", { name: "Abrir landing" }),
  ).toHaveAttribute("href", /^\/s\//);
  await page.screenshot({
    path: "docs/screenshots/agency-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/agency-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ver prospectos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sesiones", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/agency-mobile.png",
    fullPage: true,
  });
});
