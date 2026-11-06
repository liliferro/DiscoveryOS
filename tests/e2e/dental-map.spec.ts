import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

test("Landing guiada: mapa dental, persistencia, consentimiento e IA", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await request.post("/api/v1/login", {
    data: { tenantId: "dental", password: "discovery-demo" },
  });
  const dashboard = await (await request.get("/api/v1/admin/dashboard")).json();
  const original = dashboard.tenant.draft;
  try {
    const config = { ...original, dentalMapEnabled: true };
    await request.put("/api/v1/admin/template", { data: config });
    await request.post("/api/v1/admin/publish", { data: {} });
    await request.put("/api/v1/admin/connection", {
      data: {
        provider: "openai",
        model: "gpt-6.1-terra",
        apiKey: "sk-ficticia-de-prueba-no-hacer-llamadas",
        enabled: true,
        dailyLimit: 1000,
      },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/s/sonrisa");
    await expect(
      page.getByRole("heading", {
        name: "Una conversación. Un camino para ti.",
      }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText(
      "Bienvenida",
    );
    await page.screenshot({
      path: "docs/screenshots/landing-journey-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Explorar mi siguiente paso" })
      .click();
    await page
      .getByLabel("Tu nombre", { exact: true })
      .fill("Persona de prueba");
    await page
      .getByLabel("Tu WhatsApp con código de país")
      .fill("+525500000000");
    await page.getByLabel("Tu correo electrónico").fill("prueba@example.test");
    await page.getByLabel(/Autorizo que .* use estos datos/).check();
    await page.getByLabel("Entiendo el uso de mis respuestas").check();
    await page.getByRole("button", { name: "Comenzar conversación" }).click();
    await expect(page.locator('[aria-current="step"]')).toContainText(
      "Mapa dental",
    );
    await page
      .getByRole("button", { name: "Pieza 11, sin marcar", exact: true })
      .click();
    await page.getByRole("radio", { name: "Me preocupa", exact: true }).check();
    await page
      .getByRole("button", { name: "Pieza 46, sin marcar", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "2 piezas marcadas" }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "docs/screenshots/dental-map-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Guardar mapa y continuar" })
      .click();
    await expect(page.getByLabel("Tu respuesta")).toBeVisible({
      timeout: 30000,
    });
    const id = page.url().split("/").at(-1)!;
    const run = await (
      await page.request.get(`/api/v1/public/runs/${id}`)
    ).json();
    expect(run.dentalMap.teeth).toEqual([
      { number: 11, status: "missing" },
      { number: 46, status: "concern" },
    ]);
    const invalidEdit = await page.request.post(
      `/api/v1/public/runs/${id}/conversation`,
      {
        data: {
          revision: run.conversation.revision,
          operationId: randomUUID(),
          dentalMap: { skipped: true, teeth: [] },
        },
      },
    );
    expect(invalidEdit.status()).toBe(409);
    await page.reload();
    await expect(page.getByLabel("Tu respuesta")).toBeVisible();
    const stored = await (
      await page.request.get(`/api/v1/public/runs/${id}`)
    ).json();
    expect(stored.dentalMap).toEqual(run.dentalMap);
  } finally {
    await request.put("/api/v1/admin/template", { data: original });
    await request.post("/api/v1/admin/publish", { data: {} });
  }
});
