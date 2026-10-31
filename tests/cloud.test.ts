import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { transaction, initialState, type State } from "../lib/store.ts";
import { authorizeCloudAdmin } from "../lib/cloud-auth.ts";
test("Persistencia cloud con CAS, aislamiento de namespaces y autorización de membresías", async () => {
  const rows = new Map<string, { revision: number; value: State }>();
  let role = "owner";
  let active = true;
  let agencyOwner = false;
  const userId = "f277fbd9-4660-43ef-ab00-8c398b2081b9";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") {
      res.end(JSON.stringify({ id: userId, email: "owner@example.test" }));
      return;
    }
    if (url.pathname.endsWith("/discovery_memberships")) {
      if (url.searchParams.get("tenant_id") === "eq.mood") {
        res.end(JSON.stringify(agencyOwner ? [{ role: "owner" }] : []));
        return;
      }
      res.end(JSON.stringify(active ? [{ role }] : []));
      return;
    }
    const id = url.searchParams.get("id")?.replace("eq.", "") || "";
    if (req.method === "GET") {
      const row = rows.get(id);
      res.end(JSON.stringify(row ? [row] : []));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.method === "POST") {
      if (!rows.has(body.id))
        rows.set(body.id, { revision: body.revision, value: body.value });
      res.statusCode = 201;
      res.end();
      return;
    }
    if (req.method === "PATCH") {
      const row = rows.get(id);
      if (
        row?.revision ===
        Number(url.searchParams.get("revision")?.replace("eq.", ""))
      ) {
        rows.set(id, { revision: body.revision, value: body.value });
        res.end(JSON.stringify([{ revision: body.revision }]));
      } else res.end("[]");
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const names = [
    "DISCOVERY_STORAGE",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "DISCOVERY_NAMESPACE",
  ];
  const previous = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    Object.assign(process.env, {
      DISCOVERY_STORAGE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
      SUPABASE_SECRET_KEY: "test-server-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      DISCOVERY_NAMESPACE: "production",
    });
    await Promise.all([
      transaction((s) => {
        s.aiDaily = { count: (s.aiDaily?.count || 0) + 1 };
      }),
      transaction((s) => {
        s.aiDaily = { count: (s.aiDaily?.count || 0) + 1 };
      }),
    ]);
    assert.equal(rows.get("production")?.value.aiDaily?.count, 2);
    process.env.DISCOVERY_NAMESPACE = "preview";
    await transaction((s) => {
      s.aiDaily = { count: 99 };
    });
    assert.equal(rows.get("production")?.value.aiDaily?.count, 2);
    assert.equal(rows.get("preview")?.value.aiDaily?.count, 99);
    process.env.DISCOVERY_NAMESPACE = "production";
    const token = "session-test";
    await transaction((s) => {
      s.sessions.push({
        hash: createHash("sha256").update(token).digest("hex"),
        tenantId: "dental",
        userId,
        expiresAt: Date.now() + 60000,
      });
    });
    const request = (method = "GET") =>
      new NextRequest("https://app.example.test/api/v1/admin/dashboard", {
        method,
        headers: {
          Cookie: `discovery_admin=${token}; discovery_auth=test-jwt`,
        },
      });
    assert.equal((await authorizeCloudAdmin(request())).tenantId, "dental");
    assert.equal((await authorizeCloudAdmin(request())).agencyAdmin, false);
    role = "analyst";
    await assert.rejects(
      () => authorizeCloudAdmin(request("PUT")),
      /Solo el responsable/,
    );
    agencyOwner = true;
    assert.equal((await authorizeCloudAdmin(request("PUT"))).agencyAdmin, true);
    agencyOwner = false;
    active = false;
    await assert.rejects(
      () => authorizeCloudAdmin(request()),
      /no tiene acceso/,
    );
    assert.equal(initialState().tenants.length, 3);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
