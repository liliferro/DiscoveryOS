import { test, expect, request as requestFactory } from "@playwright/test";
test("Recorrido en móvil: responder, reanudar, procesar e informe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/mood");
  await expect(
    page.getByRole("heading", { name: /Tu negocio tiene/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Descubrir mi siguiente paso" })
    .click();
  await expect(page).toHaveURL(/\/r\//);
  await page
    .getByRole("textbox", { name: "¿Cómo se llama tu empresa?" })
    .fill("Empresa ejemplo UI");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "¿A qué se dedica tu empresa?" })
    .fill("Servicios creativos");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: /Atraer mejores clientes/ }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: /Referidos/ }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "¿Tienes un proceso de seguimiento definido?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "¿Cuál es el mayor obstáculo hoy?" })
    .fill("No medimos los resultados");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("spinbutton").fill("6");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Todo listo para tu discovery." }),
  ).toBeVisible();
  await page.getByLabel("Entiendo el uso").check();
  await page.getByRole("button", { name: "Crear mi diagnóstico" }).click();
  await expect(
    page.getByRole("heading", { name: /De tus respuestas/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Una dirección más clara." }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Fuente sintética.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/report-mobile.png",
    fullPage: true,
  });
});
test("Acceso privado, idempotencia, versiones y separación de tenants", async ({
  request,
}) => {
  const created = await request.post("/api/v1/public/runs", {
    data: { slug: "mood" },
  });
  const { id } = await created.json();
  const runUrl = `/api/v1/public/runs/${id}`;
  const before = await (await request.get(runUrl)).json();
  const outsider = await requestFactory.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  expect((await outsider.get(runUrl)).status()).toBe(404);
  expect((await outsider.get("/api/v1/admin/dashboard")).status()).toBe(401);
  await outsider.dispose();
  const data = {
    answers: {
      company: "Empresa ejemplo API",
      sector: "Demo",
      has_site: false,
      website: "https://oculto.example",
      goal: "Atraer mejores clientes",
      channels: ["Referidos"],
      measurement: false,
      process: false,
      challenge: "Prueba",
    },
    privacy: true,
    marketing: false,
  };
  expect((await request.put(runUrl + "/answers", { data })).status()).toBe(200);
  await request.post("/api/v1/login", {
    data: { tenantId: "mood", password: "discovery-demo" },
  });
  await request.post("/api/v1/admin/publish", { data: {} });
  expect((await (await request.get(runUrl)).json()).versionId).toBe(
    before.versionId,
  );
  await Promise.all([
    request.post(runUrl + "/submit", { data: {} }),
    request.post(runUrl + "/submit", { data: {} }),
  ]);
  const run = await (await request.get(runUrl)).json();
  expect(run.answers.website).toBeUndefined();
  expect(run.state).toBe("processing");
  expect((await request.put(runUrl + "/answers", { data })).status()).toBe(409);
  await request.post("/api/v1/login", {
    data: { tenantId: "norte", password: "discovery-demo" },
  });
  const dashboard = await (await request.get("/api/v1/admin/dashboard")).json();
  expect(dashboard.tenant.id).toBe("norte");
  expect(dashboard.runs.some((r: { id: string }) => r.id === id)).toBe(false);
  expect(
    (
      await request.post("/api/v1/admin/retry", { data: { runId: id } })
    ).status(),
  ).toBe(404);
  await expect
    .poll(async () => (await (await request.get(runUrl)).json()).state, {
      timeout: 20000,
    })
    .toBe("completed_limited");
  const report = (await (await request.get(runUrl)).json()).report;
  expect(report.tenantName).not.toBe("Norte Industrial");
  expect(report.services).not.toContain("Tablero de oportunidades");
});
test("Timeout recuperable e indisponibilidad persistente con reintento", async ({
  request,
}) => {
  async function run(scenario: string) {
    const { id } = await (
      await request.post("/api/v1/public/runs", { data: { slug: "norte" } })
    ).json();
    const url = `/api/v1/public/runs/${id}`;
    await request.put(url + "/answers", {
      data: {
        answers: {
          company: "Fallo simulado",
          sector: "B2B",
          has_site: false,
          goal: "Ordenar la operación",
          channels: ["Referidos"],
          measurement: false,
          process: true,
          challenge: "Demo",
        },
        privacy: true,
      },
    });
    await request.post(url + "/submit", { data: { scenario } });
    return { id, url };
  }
  const recoverable = await run("timeout");
  await expect
    .poll(
      async () => (await (await request.get(recoverable.url)).json()).state,
      { timeout: 20000 },
    )
    .toBe("completed_limited");
  expect((await (await request.get(recoverable.url)).json()).job.attempts).toBe(
    1,
  );
  const failed = await run("unavailable");
  await expect
    .poll(async () => (await (await request.get(failed.url)).json()).state, {
      timeout: 20000,
    })
    .toBe("failed");
  await request.post("/api/v1/login", {
    data: { tenantId: "norte", password: "discovery-demo" },
  });
  expect(
    (
      await request.post("/api/v1/admin/retry", { data: { runId: failed.id } })
    ).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await (await request.get(failed.url)).json()).state, {
      timeout: 20000,
    })
    .toBe("completed_limited");
});
test("Panel desktop: login, constructor, integración y configuración", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Todo empieza con una buena pregunta." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Constructor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Diseña la conversación" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Integraciones", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Firecrawl", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Una experiencia con tu identidad" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Cambiar empresa" }).click();
  await page
    .getByRole("combobox", { name: "Empresa", exact: true })
    .selectOption("norte");
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(page.getByLabel("Nombre de la empresa")).toHaveValue(
    "Norte Industrial",
  );
});
