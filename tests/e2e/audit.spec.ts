import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { contrastRatio } from "../../lib/brand";

test("Auditoría UX: accesibilidad, teclado, red y pantallas pequeñas", async ({
  page,
}) => {
  test.setTimeout(120000);
  const findings: unknown[] = [];
  const scriptErrors: string[] = [];
  page.on("pageerror", (error) => scriptErrors.push(error.message));
  async function audit(name: string, target: Page = page) {
    const result = await new AxeBuilder({ page: target })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    for (const violation of result.violations)
      findings.push({
        screen: name,
        rule: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          detail: node.failureSummary,
        })),
      });
    expect(
      await target.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/agency");
  await expect(
    page.getByRole("button", { name: "Entrar al workspace" }),
  ).toBeVisible();
  await audit("Acceso");
  await page.getByRole("button", { name: "Entrar al workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu agencia. Todas tus marcas." }),
  ).toBeVisible();
  await audit("Agencia escritorio");
  await page.screenshot({
    path: "docs/screenshots/audit-agency-desktop.png",
    fullPage: true,
  });
  for (const tab of [
    "Vista general",
    "Sesiones",
    "Integraciones",
    "Configuración",
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await audit(tab);
  }
  await page
    .getByRole("button", { name: "Agencia · Clientes", exact: true })
    .click();
  await page.setViewportSize({ width: 360, height: 800 });
  await audit("Agencia móvil 360");
  await page.getByRole("button", { name: "Constructor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Diseña la conversación" }),
  ).toBeVisible();
  await audit("Constructor móvil");
  const title = page.getByLabel("Título", { exact: true });
  const originalTitle = await title.inputValue();
  await title.fill(originalTitle + " · prueba sin guardar");
  await expect(
    page.getByRole("status").filter({ hasText: "Cambios sin guardar" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Agencia · Clientes", exact: true })
    .click();
  await expect(title).toHaveValue(originalTitle + " · prueba sin guardar");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Agencia · Clientes", exact: true })
    .click();
  await expect(title).toHaveCount(0);
  await page.goto("/s/sonrisa");
  await expect(
    page.getByRole("button", { name: "Explorar mi siguiente paso" }),
  ).toBeVisible();
  await audit("Bienvenida del visitante");
  await page
    .getByRole("button", { name: "Explorar mi siguiente paso" })
    .click();
  await expect(page.getByLabel("Tu nombre", { exact: true })).toBeVisible();
  await audit("Formulario de contacto");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Persona de prueba");
  await page.getByLabel("Tu WhatsApp con código de país").fill("+525500000000");
  await page.getByLabel("Tu correo electrónico").fill("correo-invalido");
  await page.getByLabel(/Autorizo que .* use estos datos/).check();
  await page.getByLabel("Entiendo el uso de mis respuestas").check();
  await page.getByRole("button", { name: "Comenzar conversación" }).click();
  expect(
    await page
      .getByLabel("Tu correo electrónico")
      .evaluate((element: HTMLInputElement) => element.validity.valid),
  ).toBe(false);
  await expect(
    page.getByRole("region", { name: "Preparando tu siguiente paso" }),
  ).toHaveCount(0);
  await page.getByLabel("Tu correo electrónico").fill("");
  await page.screenshot({
    path: "docs/screenshots/audit-patient-mobile.png",
    fullPage: true,
  });
  const dashboard = await (
    await page.request.get("/api/v1/admin/dashboard")
  ).json();
  const original = dashboard.tenant;
  try {
    await page.request.put("/api/v1/admin/brand", {
      data: {
        name: original.name,
        color: "#f4b4d1",
        cta: original.cta,
        services: original.services,
      },
    });
    await page.goto(`/s/${original.slug}`);
    const button = page.getByRole("button", {
      name: "Descubrir mi siguiente paso",
    });
    await expect(button).toBeVisible();
    await button.hover();
    await button.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    const colors = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
    const hex = (value: string) =>
      "#" +
      value
        .match(/\d+/g)!
        .slice(0, 3)
        .map((number) => Number(number).toString(16).padStart(2, "0"))
        .join("");
    expect(
      contrastRatio(hex(colors.foreground), hex(colors.background)),
    ).toBeGreaterThanOrEqual(4.5);
    await audit("Marca clara con botón en hover");
  } finally {
    await page.request.put("/api/v1/admin/brand", {
      data: {
        name: original.name,
        color: original.color,
        cta: original.cta,
        services: original.services,
      },
    });
  }
  expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  expect(scriptErrors).toEqual([]);
});
