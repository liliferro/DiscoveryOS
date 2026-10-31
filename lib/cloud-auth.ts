import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { supabasePublic, supabaseServer, cloudNamespace } from "./cloud.ts";
import { transaction } from "./store.ts";
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function membership(userId: string, tenantId: string) {
  const result = await supabaseServer()
    .from("discovery_memberships")
    .select("role")
    .eq("namespace", cloudNamespace())
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();
  if (result.error)
    throw new AuthError(503, "No se pudieron comprobar los permisos.");
  if (!result.data)
    throw new AuthError(403, "Tu usuario no tiene acceso a esta empresa.");
  return result.data.role as "owner" | "analyst";
}
async function agencyMembership(userId: string) {
  const result = await supabaseServer()
    .from("discovery_memberships")
    .select("role")
    .eq("namespace", cloudNamespace())
    .eq("user_id", userId)
    .eq("tenant_id", "mood")
    .eq("active", true)
    .maybeSingle();
  if (result.error)
    throw new AuthError(
      503,
      "No se pudieron comprobar los permisos de agencia.",
    );
  return result.data?.role === "owner";
}
export async function cloudLogin(input: unknown) {
  const data = input as Record<string, unknown>;
  if (
    typeof data.email !== "string" ||
    typeof data.password !== "string" ||
    typeof data.tenantId !== "string" ||
    data.email.length > 254 ||
    data.password.length > 250
  )
    throw new AuthError(422, "Introduce correo, contraseña y empresa.");
  const auth = await supabasePublic().auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (auth.error || !auth.data.session || !auth.data.user)
    throw new AuthError(401, "Correo o contraseña incorrectos.");
  if (auth.data.user.email_confirmed_at && auth.data.user.email) {
    const claim = await supabaseServer().rpc("discovery_claim_owner", {
      p_namespace: cloudNamespace(),
      p_email: auth.data.user.email.toLowerCase(),
      p_user_id: auth.data.user.id,
      p_tenant_id: data.tenantId,
    });
    if (claim.error)
      throw new AuthError(503, "No se pudo completar la autorización inicial.");
  }
  if (!(await agencyMembership(auth.data.user.id)))
    await membership(auth.data.user.id, data.tenantId);
  const exists = await transaction((state) =>
    state.tenants.some((t) => t.id === data.tenantId),
  );
  if (!exists) throw new AuthError(404, "Empresa no disponible.");
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  await transaction((state) => {
    state.sessions.push({
      hash,
      tenantId: data.tenantId as string,
      userId: auth.data.user.id,
      expiresAt: Date.now() + auth.data.session!.expires_in * 1000,
    });
  });
  const response = NextResponse.json({ ok: true });
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: auth.data.session.expires_in,
  };
  response.cookies.set("discovery_admin", token, options);
  response.cookies.set(
    "discovery_auth",
    auth.data.session.access_token,
    options,
  );
  return response;
}
export async function cloudSignup(input: unknown) {
  const body = input as Record<string, unknown>;
  if (
    typeof body.email !== "string" ||
    body.email.length > 254 ||
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 250 ||
    typeof body.tenantId !== "string"
  )
    throw new AuthError(
      422,
      "Usa tu correo autorizado y una contraseña de al menos 12 caracteres.",
    );
  const email = body.email.trim().toLowerCase();
  const invite = await supabaseServer()
    .from("discovery_owner_invites")
    .select("tenant_id")
    .eq("namespace", cloudNamespace())
    .eq("email", email)
    .eq("tenant_id", body.tenantId)
    .is("claimed_by", null)
    .maybeSingle();
  if (invite.error || !invite.data)
    throw new AuthError(
      403,
      "No hay una invitación inicial disponible para estos datos.",
    );
  const result = await supabasePublic().auth.signUp({
    email,
    password: body.password,
  });
  if (result.error)
    throw new AuthError(
      422,
      "No se pudo crear el acceso. Comprueba los datos o inicia sesión si ya tienes cuenta.",
    );
  return NextResponse.json({
    ok: true,
    message:
      "Acceso solicitado. Revisa tu correo para confirmar la cuenta y después inicia sesión.",
  });
}
export async function authorizeCloudAdmin(req: NextRequest) {
  const token = req.cookies.get("discovery_admin")?.value || "";
  const hash = createHash("sha256").update(token).digest("hex");
  const session = await transaction((state) =>
    state.sessions.find((s) => s.hash === hash && s.expiresAt > Date.now()),
  );
  if (!session?.userId)
    throw new AuthError(401, "Inicia sesión para continuar.");
  const jwt = req.cookies.get("discovery_auth")?.value;
  if (!jwt) throw new AuthError(401, "Tu sesión caducó.");
  const auth = await supabasePublic().auth.getUser(jwt);
  if (auth.error || auth.data.user?.id !== session.userId)
    throw new AuthError(401, "Tu sesión caducó.");
  const agencyAdmin = await agencyMembership(session.userId);
  const role = agencyAdmin
    ? "owner"
    : await membership(session.userId, session.tenantId);
  if (req.method !== "GET" && role !== "owner")
    throw new AuthError(
      403,
      "Solo el responsable puede cambiar esta configuración.",
    );
  return { ...session, agencyAdmin };
}
