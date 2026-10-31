import { test } from "node:test";
import assert from "node:assert/strict";
import { api, ApiRequestError } from "../lib/client.ts";
import { brandStyle, contrastRatio } from "../lib/brand.ts";

test("La interfaz distingue red, HTML de error y sesión caducada sin mostrar errores de JSON", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<html>Error</html>", { status: 502 });
    await assert.rejects(api("config"), /El servicio no pudo responder/);
    globalThis.fetch = async () =>
      Response.json({ message: "Tu sesión caducó" }, { status: 401 });
    await assert.rejects(
      api("admin/dashboard"),
      (error: unknown) =>
        error instanceof ApiRequestError && error.status === 401,
    );
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(api("config"), /Revisa tu conexión/);
    globalThis.fetch = async () => {
      throw new DOMException("Timeout", "TimeoutError");
    };
    await assert.rejects(api("config"), /siguen guardadas/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Los colores de cada marca mantienen contraste legible, incluso con tonos claros", () => {
  for (const color of [
    "#ffffff",
    "#ffea00",
    "#f4b4d1",
    "#eeeeee",
    "#137c73",
    "#6756d8",
    "#000000",
  ]) {
    const style = brandStyle(color);
    assert.equal(style["--brand"], color);
    assert.ok(
      contrastRatio(style["--brand"], style["--brand-contrast"]) >= 4.5,
    );
    assert.ok(contrastRatio(style["--brand-ink"], "#f1effc") >= 4.8);
  }
  assert.equal(brandStyle("red;display:none")["--brand"], "#6756d8");
});
