import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("Discovery adaptativa: contexto privado, consentimiento, edición, segmentación e idempotencia", async ({
  request,
  page,
}) => {
  const publicSession = await (
    await request.get("/api/v1/public/sessions/sonrisa")
  ).json();
  expect(publicSession.version.config.mode).toBe("adaptive");
  expect(publicSession.version.config.discovery).toBeUndefined();
  await request.post("/api/v1/login", {
    data: { tenantId: "dental", password: "discovery-demo" },
  });
  const dashboard = await (await request.get("/api/v1/admin/dashboard")).json();
  const config = dashboard.tenant.draft;
  config.discovery.minTurns = 2;
  config.discovery.maxTurns = 4;
  await request.put("/api/v1/admin/template", { data: config });
  await request.post("/api/v1/admin/publish", { data: {} });
  const { id } = await (
    await request.post("/api/v1/public/runs", { data: { slug: "sonrisa" } })
  ).json();
  const url = `/api/v1/public/runs/${id}/conversation`;
  expect(
    (
      await request.post(url, {
        data: { revision: 0, operationId: randomUUID(), privacy: true },
      })
    ).status(),
  ).toBe(503);
  const key = "sk-ficticia-de-prueba-no-hacer-llamadas";
  const saved = await (
    await request.put("/api/v1/admin/connection", {
      data: {
        model: "gpt-6.1-terra",
        apiKey: key,
        enabled: true,
        dailyLimit: 100,
      },
    })
  ).json();
  expect(saved.configured).toBe(true);
  expect(JSON.stringify(saved)).not.toContain(key);
  expect(
    (
      await request.post(url, {
        data: { revision: 0, operationId: randomUUID() },
      })
    ).status(),
  ).toBe(422);
  let run = await (
    await request.post(url, {
      data: { revision: 0, operationId: randomUUID(), privacy: true },
    })
  ).json();
  expect(run.conversation.turns).toHaveLength(1);
  expect(run.config.discovery).toBeUndefined();
  expect(run.conversation.lease).toBeUndefined();
  const operation = {
    revision: run.conversation.revision,
    operationId: randomUUID(),
    index: 0,
    answer: "Me falta una pieza y quiero informarme",
  };
  run = await (await request.post(url, { data: operation })).json();
  const replay = await (await request.post(url, { data: operation })).json();
  expect(replay.conversation.revision).toBe(run.conversation.revision);
  expect(run.conversation.decision.segments[0].service).toBe(
    "Implantes dentales",
  );
  run = await (
    await request.post(url, {
      data: {
        revision: run.conversation.revision,
        operationId: randomUUID(),
        index: 1,
        answer: "Quiero entender el proceso",
      },
    })
  ).json();
  expect(run.conversation.turns).toHaveLength(3);
  run = await (
    await request.post(url, {
      data: {
        revision: run.conversation.revision,
        operationId: randomUUID(),
        index: 0,
        answer: "Quiero explorar carillas para la apariencia de mi sonrisa",
      },
    })
  ).json();
  expect(run.conversation.turns).toHaveLength(2);
  expect(run.conversation.decision.segments[0].service).toBe("Carillas");
  expect(run.conversation.turns[1].answer).toBeUndefined();
  for (let i = 1; i < 4; i++) {
    run = await (
      await request.post(url, {
        data: {
          revision: run.conversation.revision,
          operationId: randomUUID(),
          index: i,
          answer: `Detalle de prueba ${i}`,
        },
      })
    ).json();
  }
  expect(run.conversation.closed).toBe(true);
  expect(run.conversation.turns).toHaveLength(4);
  expect(run.state).toBe("completed_limited");
  expect(run.conversation.provider).toBe("fixture");
  expect(run.patientResult.status).toBe("ready_for_review");
  expect(
    run.patientResult.options.map((s: { service: string }) => s.service),
  ).toEqual(["Carillas"]);
  expect(new URL(run.patientResult.bookingUrl).pathname).toBe("/525523153249");
  const persisted = await (
    await request.get(`/api/v1/public/runs/${id}`)
  ).json();
  expect(persisted.patientResult).toEqual(run.patientResult);
  const review = await (await request.get("/api/v1/admin/dashboard")).json();
  expect(
    review.runs.find((r: { id: string }) => r.id === id).patientResult.status,
  ).toBe("ready_for_review");
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto(`/r/${id}`);
  await expect(
    page.getByRole("heading", { name: /Gracias por contarnos/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Agendar mi valoración/ }),
  ).toHaveAttribute("href", run.patientResult.bookingUrl);
  await expect(
    page.getByRole("button", { name: "Imprimir resumen" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Perfil y trazabilidad" }),
  ).toHaveCount(0);
  await request.post("/api/v1/login", {
    data: { tenantId: "mood", password: "discovery-demo" },
  });
  expect(
    (await (await request.get("/api/v1/admin/dashboard")).json()).runs.some(
      (r: { id: string }) => r.id === id,
    ),
  ).toBe(false);
});
test("Experiencia móvil adaptativa y configuración del objetivo en el panel", async ({
  page,
  request,
}) => {
  await request.post("/api/v1/login", {
    data: { tenantId: "dental", password: "discovery-demo" },
  });
  await request.put("/api/v1/admin/connection", {
    data: {
      model: "gpt-6.1-terra",
      apiKey: "sk-prueba-ui-clave-sintetica-no-real",
      enabled: true,
      dailyLimit: 100,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/sonrisa");
  await page
    .getByRole("button", { name: "Explorar mi siguiente paso" })
    .click();
  await page.getByLabel("Entiendo el uso de mis respuestas").check();
  await page.getByRole("button", { name: "Comenzar conversación" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Qué te gustaría mejorar de tu sonrisa/,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("Me falta una pieza y quiero conocer opciones");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Mencionaste/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/adaptive-mobile.png",
    fullPage: true,
  });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Empresa", exact: true })
    .selectOption("dental");
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await page.getByRole("button", { name: "Constructor", exact: true }).click();
  await expect(page.getByLabel("Objetivo del discovery")).toContainText("");
  await expect(page.getByLabel("Objetivo del discovery")).toHaveValue(
    /segmentar/,
  );
  await page
    .getByRole("button", { name: "Integraciones", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Conecta la inteligencia de tu discovery.",
    }),
  ).toBeVisible();
});
