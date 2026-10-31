import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Recuperar contraseña: acceso visible, envío y contraseña confirmada", async ({
  page,
}) => {
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { cloud: true, auth: "supabase" } }),
  );
  await page.route("**/api/v1/auth/recovery", (route) =>
    route.fulfill({
      json: {
        message:
          "Si el correo está registrado, recibirás un enlace para elegir una contraseña nueva.",
      },
    }),
  );
  await page.goto("/agency");
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(
    page.getByRole("heading", { name: "Recupera tu acceso." }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await page.getByLabel("Correo de tu cuenta").fill("recovery@example.test");
  await page
    .getByRole("button", { name: "Enviar enlace de recuperación" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Si el correo está registrado",
  );
  let bootstraps = 0,
    updates = 0;
  await page.route("**/api/v1/auth/recovery-session", (route) => {
    if (route.request().method() === "POST") bootstraps++;
    return route.fulfill({ json: { ready: true } });
  });
  await page.route("**/api/v1/auth/recovery-password", (route) => {
    updates++;
    return route.fulfill({
      json: {
        message:
          "Contraseña actualizada. Inicia sesión con tu contraseña nueva.",
      },
    });
  });
  await page.goto(
    "/reset-password#access_token=synthetic-test-access&refresh_token=synthetic-test-refresh&type=recovery",
  );
  await expect(
    page.getByLabel("Contraseña nueva", { exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  expect(bootstraps).toBe(1);
  const resetAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(resetAccessibility.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/reset-password.png",
    fullPage: true,
  });
  await page
    .getByLabel("Contraseña nueva", { exact: true })
    .fill("Test-only-password-2026");
  await page
    .getByLabel("Repite la contraseña nueva")
    .fill("Different-password-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "no coinciden",
  );
  expect(updates).toBe(0);
  await page
    .getByLabel("Repite la contraseña nueva")
    .fill("Test-only-password-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Contraseña actualizada",
  );
  expect(updates).toBe(1);
});

test("Un enlace caducado ofrece solicitar otro y no permite cambiar la contraseña", async ({
  page,
}) => {
  await page.goto("/reset-password#error=access_denied&error_code=otp_expired");
  await expect(page.locator(".recovery-card").getByRole("alert")).toContainText(
    "caducó",
  );
  await expect(
    page.getByRole("link", { name: "Solicitar un enlace nuevo" }),
  ).toHaveAttribute("href", "/forgot-password");
  await expect(
    page.getByRole("button", { name: "Guardar contraseña" }),
  ).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
});
