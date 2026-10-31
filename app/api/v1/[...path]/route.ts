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
import { exportLeads } from "@/lib/lead-export";
import { leadContactSchema } from "@/lib/lead-contact";
import {
  requestPasswordRecovery,
  beginPasswordRecovery,
  recoveryStatus,
  updateRecoveredPassword,
} from "@/lib/password-recovery";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function safeRun(run: Run, internal = false) {
  return publicRun(run, internal);
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function readBody(
  req: NextRequest,
  limit: number,
): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new ApiError(413, "Solicitud demasiado grande");
    }
    chunks.push(chunk.value);
  }
  if (!length) return {};
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(422, "El formato de la solicitud no es válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(422, "La solicitud debe contener un objeto JSON.");
  return body as Record<string, unknown>;
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
    const bodyLimit = ["admin", "agency"].includes(path[0]) ? 262144 : 64000;
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
      if (Number(req.headers.get("content-length") || 0) > bodyLimit)
        throw new ApiError(413, "Solicitud demasiado grande");
    }
    const body = method === "GET" ? {} : await readBody(req, bodyLimit);
    if (path[0] === "config" && method === "GET")
      return NextResponse.json(
        { cloud: isCloud(), auth: isCloud() ? "supabase" : "demo" },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (isCloud() && path[0] === "login" && method === "POST")
      return await cloudLogin(body);
    if (isCloud() && path[0] === "signup" && method === "POST")
      return await cloudSignup(body);
    if (path[0] === "auth" && path[1]?.startsWith("recovery")) {
      if (!isCloud())
        throw new AuthError(
          503,
          "La recuperación de contraseña está disponible para las cuentas en la nube.",
        );
      if (path[1] === "recovery" && method === "POST")
        return await requestPasswordRecovery(body, req.nextUrl.origin);
      if (path[1] === "recovery-session" && method === "POST")
        return await beginPasswordRecovery(body);
      if (path[1] === "recovery-session" && method === "GET")
        return await recoveryStatus(req);
      if (path[1] === "recovery-password" && method === "POST")
        return await updateRecoveredPassword(req, body);
      throw new ApiError(404, "Recurso no disponible");
    }
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
        if (path.length === 2 && path[1] === "export" && method === "GET")
          return exportLeads(
            state,
            Object.fromEntries(req.nextUrl.searchParams),
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
        if (tenant.deletedAt && method !== "GET")
          throw new ApiError(
            409,
            "Restaura la landing desde Agencia antes de modificarla.",
          );
        if (path[1] === "connection" && method === "GET")
          return connectionView(
            state.aiConnections?.[tenant.id] || defaultConnection(),
          );
        if (path[1] === "connection" && method === "PUT") {
          const input = connectionSchema.parse(body);
          state.aiConnections ||= {};
          const current = state.aiConnections[tenant.id] || defaultConnection();
          const providerChanged =
            !!input.provider &&
            input.provider !== (current.provider || "openai");
          if (providerChanged && current.cipher && !input.apiKey?.trim())
            throw new ApiError(
              422,
              "Al cambiar de proveedor, introduce la clave del nuevo proveedor.",
            );
          if (providerChanged) current.verified = false;
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
              .map((r) => ({ ...safeRun(r, true), config: r.config })),
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
            typeof body.color !== "string" ||
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
        if (
          !tenant ||
          tenant.deletedAt ||
          tenant.published === false ||
          !tenant.versions.length
        )
          throw new ApiError(404, "Sesión no disponible");
        return {
          name: tenant.name,
          color: tenant.color,
          logoUrl: tenant.logoUrl,
          slug: tenant.slug,
          version: {
            ...tenant.versions.at(-1)!,
            config: publicConfig(tenant.versions.at(-1)!.config, tenant),
          },
          aiReady: (() => {
            const connection =
              state.aiConnections?.[tenant.id] || defaultConnection();
            return connection.enabled && connectionView(connection).configured;
          })(),
        };
      }
      if (
        path[0] === "public" &&
        path[1] === "runs" &&
        path.length === 2 &&
        method === "POST"
      ) {
        const tenant = state.tenants.find((t) => t.slug === body.slug);
        if (
          !tenant ||
          tenant.deletedAt ||
          tenant.published === false ||
          !tenant.versions.length
        )
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
          contactRequired: !!version.config.discovery?.enabled,
          marketing: false,
        });
        issued = { name: `run_${id}`, token };
        return { id };
      }
      if (path[0] === "public" && path[1] === "runs" && path[2]) {
        const run = state.runs.find((r) => r.id === path[2]);
        if (
          !run ||
          state.tenants.find((t) => t.id === run.tenantId)?.deletedAt ||
          run.expiresAt < Date.now() ||
          run.tokenHash !== hash(req.cookies.get(`run_${path[2]}`)?.value || "")
        )
          throw new ApiError(404, "Ejecución no disponible o acceso caducado");
        if (method === "GET") {
          return safeRun(run);
        }
        if (path[3] === "contact" && method === "PUT") {
          if (
            run.conversation?.turns.length ||
            run.conversation?.lease ||
            run.state !== "draft"
          )
            throw new ApiError(
              409,
              "Los datos de contacto se registran antes de comenzar la conversación.",
            );
          const parsed = leadContactSchema.safeParse(body);
          if (!parsed.success)
            throw new ApiError(
              422,
              "Revisa tu nombre, WhatsApp con código de país y correo, y acepta el uso de tus datos para atender tu solicitud.",
            );
          const { name, whatsapp, email } = parsed.data;
          run.contact = {
            name,
            whatsapp,
            email,
            consentedAt: new Date().toISOString(),
            noticeVersion: "lead-contact-v1",
          };
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
            scenario:
              body.scenario === "timeout" || body.scenario === "unavailable"
                ? body.scenario
                : "normal",
            sources: [],
          };
          return { id: run.id, state: run.state };
        }
      }
      throw new ApiError(404, "Recurso no disponible");
    });
    if (path[0] === "agency" && path[1] === "export" && method === "GET") {
      const file = result as { csv: string; filename: string };
      return new NextResponse(file.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
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
    if (path[0] === "logout" && method === "POST")
      response.cookies.set("discovery_auth", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    return response;
  } catch (error) {
    const infrastructureFailure =
      error instanceof Error &&
      /^(CLOUD_|VAULT_|INVALID_APP_ENCRYPTION_KEY)/.test(error.message);
    const status = infrastructureFailure
      ? 503
      : error instanceof ApiError ||
          error instanceof AgencyError ||
          error instanceof DiscoveryError ||
          error instanceof AuthError
        ? error.status
        : 422;
    return NextResponse.json(
      {
        code: status === 422 ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message: infrastructureFailure
          ? "No se pudo acceder al servicio en este momento. Espera unos segundos y vuelve a intentarlo."
          : path[0] === "public" &&
              error instanceof DiscoveryError &&
              [402, 424, 502, 503].includes(status)
            ? "No pudimos preparar tu siguiente pregunta. Reintenta en unos minutos o contacta al equipo."
            : error instanceof ApiError ||
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
