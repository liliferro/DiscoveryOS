import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { transaction } from "@/lib/store";
import { validateAnswers, validateConfig, type Run } from "@/lib/domain";
import {
  publicConfig,
  publicRun,
  advanceConversation,
} from "@/lib/conversation-service";
import {
  connectionSchema,
  connectionView,
  defaultConnection,
  encryptSecret,
  testFixtureEnabled,
} from "@/lib/ai-settings";
import { DiscoveryError, verifyConnection } from "@/lib/ai-provider";
import { isCloud } from "@/lib/cloud";
import {
  cloudLogin,
  cloudSignup,
  authorizeCloudAdmin,
  AuthError,
} from "@/lib/cloud-auth";
import { processLegacyRun } from "@/lib/job-runner";
import { handleAgency, AgencyError } from "@/lib/agency";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function safeRun(run: Run) {
  return publicRun(run);
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path;
  const method = req.method;
  const requestId = randomUUID();
  let issued: { name: string; token: string } | undefined;
  let cloudAgencyAdmin = false;
  try {
    if (method !== "GET") {
      if (
        req.headers.get("origin") &&
        !new Set([
          ...(process.env.VERCEL_URL
            ? [`https://${process.env.VERCEL_URL}`]
            : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
          process.env.APP_BASE_URL ||
            `http://127.0.0.1:${process.env.PORT || 3000}`,
          ...(process.env.NODE_ENV !== "production"
            ? [`http://localhost:${process.env.PORT || 3000}`]
            : []),
        ]).has(req.headers.get("origin")!)
      )
        throw new ApiError(403, "Origen no permitido");
      if (
        Number(req.headers.get("content-length") || 0) >
        (path[0] === "agency" ? 200000 : 64000)
      )
        throw new ApiError(413, "Solicitud demasiado grande");
    }
    const raw = method === "GET" ? "" : await req.text();
    if (raw.length > (path[0] === "agency" ? 200000 : 64000))
      throw new ApiError(413, "Solicitud demasiado grande");
    const body = raw ? JSON.parse(raw) : {};
    if (path[0] === "config" && method === "GET")
      return NextResponse.json(
        { cloud: isCloud(), auth: isCloud() ? "supabase" : "demo" },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (isCloud() && path[0] === "login" && method === "POST")
      return await cloudLogin(body);
    if (isCloud() && path[0] === "signup" && method === "POST")
      return await cloudSignup(body);
    if (isCloud() && ["admin", "agency"].includes(path[0])) {
      cloudAgencyAdmin = (await authorizeCloudAdmin(req)).agencyAdmin;
      if (path[0] === "agency" && !cloudAgencyAdmin)
        throw new ApiError(
          403,
          "Solo la administración de la agencia puede gestionar clientes y landings.",
        );
    }
    if (
      method === "POST" &&
      path[0] === "public" &&
      path[1] === "runs" &&
      path[3] === "conversation"
    ) {
      const result = await advanceConversation(
        path[2],
        req.cookies.get(`run_${path[2]}`)?.value || "",
        body,
      );
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (
      method === "POST" &&
      path[0] === "admin" &&
      path[1] === "connection-test"
    ) {
      const prepared = await transaction((state) => {
        const session = state.sessions.find(
          (s) =>
            s.hash === hash(req.cookies.get("discovery_admin")?.value || "") &&
            s.expiresAt > Date.now(),
        );
        if (!session) throw new ApiError(401, "Inicia sesión para continuar");
        return {
          tenantId: session.tenantId,
          connection:
            state.aiConnections?.[session.tenantId] || defaultConnection(),
        };
      });
      if (!testFixtureEnabled()) await verifyConnection(prepared.connection);
      await transaction((state) => {
        const current = state.aiConnections?.[prepared.tenantId];
        if (
          current &&
          current.model === prepared.connection.model &&
          current.cipher === prepared.connection.cipher
        )
          current.verified = true;
      });
      return NextResponse.json({
        ok: true,
        message:
          "Clave y acceso al modelo comprobados. La calidad de las respuestas se comprueba con una sesión.",
      });
    }
    const result = await transaction((state) => {
      if (path[0] === "login" && method === "POST") {
        const expected = hash(process.env.DEMO_PASSWORD || "discovery-demo");
        if (
          !timingSafeEqual(
            Buffer.from(hash(String(body.password))),
            Buffer.from(expected),
          )
        )
          throw new ApiError(401, "Contraseña incorrecta");
        const tenant = state.tenants.find((t) => t.id === body.tenantId);
        if (!tenant) throw new ApiError(404, "Empresa no disponible");
        const token = randomBytes(32).toString("hex");
        state.sessions.push({
          hash: hash(token),
          tenantId: tenant.id,
          agencyAdmin: tenant.id === "mood",
          expiresAt: Date.now() + 86400000,
        });
        issued = { name: "discovery_admin", token };
        return { ok: true };
      }
      if (path[0] === "logout" && method === "POST") {
        const credential = req.cookies.get("discovery_admin")?.value;
        state.sessions = state.sessions.filter(
          (s) => s.hash !== hash(credential || ""),
        );
        issued = { name: "discovery_admin", token: "" };
        return { ok: true };
      }
      if (path[0] === "agency") {
        const session = state.sessions.find(
          (s) =>
            s.hash === hash(req.cookies.get("discovery_admin")?.value || "") &&
            s.expiresAt > Date.now(),
        );
        if (!session) throw new ApiError(401, "Inicia sesión para continuar");
        if (
          !(isCloud()
            ? cloudAgencyAdmin
            : session.agencyAdmin || session.tenantId === "mood")
        )
          throw new ApiError(
            403,
            "Solo la administración de la agencia puede gestionar clientes y landings.",
          );
        return handleAgency(state, session, path, method, body);
      }
      if (path[0] === "admin") {
        const credential = req.cookies.get("discovery_admin")?.value;
        const session = state.sessions.find(
          (s) => s.hash === hash(credential || "") && s.expiresAt > Date.now(),
        );
        if (!session) throw new ApiError(401, "Inicia sesión para continuar");
        const tenant = state.tenants.find((t) => t.id === session.tenantId)!;
        if (path[1] === "connection" && method === "GET")
          return connectionView(
            state.aiConnections?.[tenant.id] || defaultConnection(),
          );
        if (path[1] === "connection" && method === "PUT") {
          const input = connectionSchema.parse(body);
          state.aiConnections ||= {};
          const current = state.aiConnections[tenant.id] || defaultConnection();
          if (input.apiKey?.trim()) {
            if (input.apiKey.trim().length < 20)
              throw new ApiError(422, "La clave parece incompleta");
            current.cipher = encryptSecret(input.apiKey.trim());
            current.verified = false;
          }
          if (current.model !== input.model) current.verified = false;
          Object.assign(current, {
            provider: input.provider || current.provider || "openai",
            model: input.model,
            enabled: input.enabled,
            dailyLimit: input.dailyLimit,
          });
          if (current.enabled && !connectionView(current).configured)
            throw new ApiError(
              422,
              "Introduce una clave antes de activar la IA",
            );
          state.aiConnections[tenant.id] = current;
          return connectionView(current);
        }
        if (path[1] === "dashboard" && method === "GET")
          return {
            tenant,
            agencyAdmin: isCloud()
              ? cloudAgencyAdmin
              : !!session.agencyAdmin || session.tenantId === "mood",
            runs: state.runs
              .filter((r) => r.tenantId === tenant.id)
              .map((r) => ({ ...safeRun(r), config: r.config })),
          };
        if (path[1] === "template" && method === "PUT") {
          tenant.draft = validateConfig(body);
          return { ok: true };
        }
        if (path[1] === "publish" && method === "POST") {
          const config = validateConfig(tenant.draft);
          const version = {
            id: randomUUID(),
            number: tenant.versions.length + 1,
            config: structuredClone(config),
          };
          tenant.versions.push(version);
          tenant.published = true;
          return version;
        }
        if (path[1] === "brand" && method === "PUT") {
          if (
            typeof body.name !== "string" ||
            body.name.length < 2 ||
            body.name.length > 100 ||
            typeof body.cta !== "string" ||
            body.cta.length > 200 ||
            !/^#[0-9a-f]{6}$/i.test(body.color) ||
            !Array.isArray(body.services) ||
            body.services.length < 1 ||
            body.services.length > 12 ||
            body.services.some(
              (s: unknown) =>
                typeof s !== "string" || s.length < 2 || s.length > 120,
            )
          )
            throw new ApiError(
              422,
              "Revisa nombre, color, CTA y el catálogo de servicios",
            );
          tenant.name = body.name;
          tenant.color = body.color;
          tenant.cta = body.cta;
          tenant.services = body.services;
          const client = state.clients?.find((c) => c.id === tenant.clientId);
          if (client) {
            client.name = tenant.name;
            client.color = tenant.color;
            client.cta = tenant.cta;
            client.products = tenant.services.map((name) => ({
              name,
              description:
                client.products.find((p) => p.name === name)?.description ||
                `Servicio de ${client.name}.`,
            }));
            for (const sibling of state.tenants.filter(
              (t) => t.clientId === client.id,
            ))
              Object.assign(sibling, {
                name: client.name,
                color: client.color,
                cta: client.cta,
                services: client.products.map((p) => p.name),
              });
          }
          return { ok: true };
        }
        if (path[1] === "retry" && method === "POST") {
          const run = state.runs.find(
            (r) => r.id === body.runId && r.tenantId === tenant.id,
          );
          if (!run || run.state !== "failed" || !run.job)
            throw new ApiError(404, "Trabajo no disponible");
          run.state = "processing";
          run.job.attempts = 0;
          run.job.scenario = "normal";
          run.job.nextAt = Date.now();
          return { ok: true };
        }
        throw new ApiError(404, "Recurso no disponible");
      }
      if (path[0] === "public" && path[1] === "sessions" && method === "GET") {
        const tenant = state.tenants.find((t) => t.slug === path[2]);
        if (!tenant || tenant.published === false || !tenant.versions.length)
          throw new ApiError(404, "Sesión no disponible");
        return {
          name: tenant.name,
          color: tenant.color,
          logoUrl: tenant.logoUrl,
          slug: tenant.slug,
          version: {
            ...tenant.versions.at(-1)!,
            config: publicConfig(tenant.versions.at(-1)!.config),
          },
          aiReady: !!state.aiConnections?.[tenant.id]?.enabled,
        };
      }
      if (
        path[0] === "public" &&
        path[1] === "runs" &&
        path.length === 2 &&
        method === "POST"
      ) {
        const tenant = state.tenants.find((t) => t.slug === body.slug);
        if (!tenant || tenant.published === false || !tenant.versions.length)
          throw new ApiError(404, "Sesión no disponible");
        if (
          state.runs.filter(
            (r) =>
              r.tenantId === tenant.id &&
              Date.now() - Date.parse(r.createdAt) < 86400000,
          ).length >= 100
        )
          throw new ApiError(429, "Límite diario de demostración alcanzado");
        const version = tenant.versions.at(-1)!;
        const token = randomBytes(32).toString("hex");
        const id = randomUUID();
        state.runs.push({
          id,
          tenantId: tenant.id,
          brand: {
            name: tenant.name,
            color: tenant.color,
            logoUrl: tenant.logoUrl,
            industry: tenant.industry,
          },
          versionId: version.id,
          version: version.number,
          config: structuredClone(version.config),
          answers: {},
          tokenHash: hash(token),
          expiresAt: Date.now() + 7 * 86400000,
          createdAt: new Date().toISOString(),
          state: "draft",
          privacy: false,
          marketing: false,
        });
        issued = { name: `run_${id}`, token };
        return { id };
      }
      if (path[0] === "public" && path[1] === "runs" && path[2]) {
        const run = state.runs.find((r) => r.id === path[2]);
        if (
          !run ||
          run.expiresAt < Date.now() ||
          run.tokenHash !== hash(req.cookies.get(`run_${path[2]}`)?.value || "")
        )
          throw new ApiError(404, "Ejecución no disponible o acceso caducado");
        if (method === "GET") {
          return safeRun(run);
        }
        if (path[3] === "answers" && method === "PUT") {
          if (run.config.discovery?.enabled)
            throw new ApiError(
              409,
              "Usa la conversación para responder esta sesión",
            );
          if (run.state !== "draft")
            throw new ApiError(409, "La sesión ya fue enviada");
          run.answers = validateAnswers(run.config, body.answers);
          run.privacy = body.privacy === true;
          run.marketing = body.marketing === true;
          return { ok: true };
        }
        if (path[3] === "submit" && method === "POST") {
          if (run.config.discovery?.enabled)
            throw new ApiError(
              409,
              "La conversación se cierra con el motor de discovery",
            );
          if (run.state !== "draft") return { id: run.id, state: run.state };
          if (!run.privacy)
            throw new ApiError(422, "Debes aceptar el aviso de demostración");
          run.answers = validateAnswers(run.config, run.answers, true);
          if (
            state.runs.filter(
              (r) => r.tenantId === run.tenantId && r.state === "processing",
            ).length >= 2
          )
            throw new ApiError(
              429,
              "Hay dos análisis activos; inténtalo más tarde",
            );
          run.state = "processing";
          run.submittedAt = new Date().toISOString();
          run.job = {
            stage: 0,
            attempts: 0,
            nextAt: Date.now(),
            scenario: ["timeout", "unavailable"].includes(body.scenario)
              ? body.scenario
              : "normal",
            sources: [],
          };
          return { id: run.id, state: run.state };
        }
      }
      throw new ApiError(404, "Recurso no disponible");
    });
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
    if (path[0] === "logout")
      response.cookies.set("discovery_auth", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    if (
      isCloud() &&
      path[0] === "public" &&
      path[1] === "runs" &&
      path[2] &&
      (method === "GET" || path[3] === "submit")
    ) {
      await processLegacyRun(path[2]);
      if (method === "GET") {
        const current = await transaction((state) =>
          state.runs.find((r) => r.id === path[2]),
        );
        if (current)
          return NextResponse.json(safeRun(current), {
            headers: { "Cache-Control": "no-store" },
          });
      }
    }
    if (issued)
      response.cookies.set(issued.name, issued.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: issued.token ? 86400 * 7 : 0,
      });
    return response;
  } catch (error) {
    const status =
      error instanceof ApiError ||
      error instanceof AgencyError ||
      error instanceof DiscoveryError ||
      error instanceof AuthError
        ? error.status
        : 422;
    return NextResponse.json(
      {
        code: status === 422 ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message:
          error instanceof ApiError ||
          error instanceof AgencyError ||
          error instanceof DiscoveryError ||
          error instanceof AuthError
            ? error.message
            : status === 422
              ? "Revisa los datos: " +
                (error instanceof Error
                  ? error.message.slice(0, 250)
                  : "entrada inválida")
              : "Error en la solicitud",
        request_id: requestId,
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export { handler as GET, handler as POST, handler as PUT };
