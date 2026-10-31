import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  requestPasswordRecovery,
  beginPasswordRecovery,
  recoveryStatus,
  updateRecoveredPassword,
} from "../lib/password-recovery.ts";
import { transaction } from "../lib/store.ts";

test("Recuperación: correo, enlace validado, cambio propio y revocación de sesiones", async () => {
  const userId = randomUUID();
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "synthetic-signature",
  ].join(".");
  let redirect = "",
    savedPassword = "",
    signouts = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/recover") {
      redirect = url.searchParams.get("redirect_to") || "";
      res.end("{}");
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      signouts++;
      res.end("{}");
      return;
    }
    if (
      url.pathname === "/auth/v1/user" &&
      req.headers.authorization === `Bearer ${jwt}`
    ) {
      if (req.method === "PUT") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        savedPassword = JSON.parse(Buffer.concat(chunks).toString()).password;
      }
      res.end(JSON.stringify({ id: userId, email: "recovery@example.test" }));
      return;
    }
    res.statusCode = 401;
    res.end(JSON.stringify({ msg: "Invalid JWT", error_code: "bad_jwt" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "APP_BASE_URL",
    "DISCOVERY_DB_FILE",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      APP_BASE_URL: "https://discovery.example.test",
      DISCOVERY_DB_FILE: `recovery-test-${randomUUID()}.sqlite`,
    });
    const sent = await requestPasswordRecovery(
      { email: "recovery@example.test" },
      "https://ignored.example.test",
    );
    assert.equal(sent.status, 200);
    assert.equal(redirect, "https://discovery.example.test/reset-password");
    assert.match((await sent.json()).message, /Si el correo está registrado/);
    await assert.rejects(
      beginPasswordRecovery({
        access_token: "not-a-valid-recovery-token",
        refresh_token: "test-refresh-token",
        type: "recovery",
      }),
    );
    const begun = await beginPasswordRecovery({
      access_token: jwt,
      refresh_token: "test-refresh-token",
      type: "recovery",
    });
    assert.equal(
      begun.cookies.get("discovery_recovery_access")?.httpOnly,
      true,
    );
    assert.equal(begun.cookies.get("discovery_recovery_access")?.maxAge, 600);
    const req = new NextRequest(
      "https://discovery.example.test/api/v1/auth/recovery-password",
      {
        headers: {
          Cookie: `discovery_recovery_access=${jwt}; discovery_recovery_refresh=test-refresh-token`,
        },
      },
    );
    assert.equal((await recoveryStatus(req)).status, 200);
    await transaction((state) => {
      state.sessions.push(
        {
          hash: "recovery-owner",
          userId,
          tenantId: "mood",
          expiresAt: Date.now() + 60000,
        },
        {
          hash: "other-user",
          userId: "another-user",
          tenantId: "mood",
          expiresAt: Date.now() + 60000,
        },
      );
    });
    await assert.rejects(
      updateRecoveredPassword(req, {
        password: "Test-only-password-2026",
        confirmation: "does-not-match",
      }),
      /no coinciden/,
    );
    await assert.rejects(
      updateRecoveredPassword(new NextRequest(req.url), {
        password: "Test-only-password-2026",
        confirmation: "Test-only-password-2026",
      }),
      /enlace nuevo/,
    );
    assert.equal(savedPassword, "");
    const result = await updateRecoveredPassword(req, {
      password: "Test-only-password-2026",
      confirmation: "Test-only-password-2026",
    });
    assert.equal(savedPassword, "Test-only-password-2026");
    assert.equal(signouts, 1);
    assert.equal(result.cookies.get("discovery_recovery_access")?.maxAge, 0);
    const remaining = await transaction((state) => state.sessions);
    assert.equal(
      remaining.some((session) => session.userId === userId),
      false,
    );
    assert.equal(
      remaining.some((session) => session.userId === "another-user"),
      true,
    );
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
