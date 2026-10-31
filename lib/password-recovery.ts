import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabasePublic } from "./cloud.ts";
import { transaction } from "./store.ts";
import { AuthError } from "./cloud-auth.ts";

const accessCookie = "discovery_recovery_access";
const refreshCookie = "discovery_recovery_refresh";
const cookies = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
const response = (body: object) =>
  NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

export async function requestPasswordRecovery(input: unknown, origin: string) {
  const { email } = z
    .object({ email: z.string().trim().max(254).pipe(z.email()) })
    .parse(input);
  const base =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : origin);
  const result = await supabasePublic().auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/reset-password", base).href,
  });
  if (result.error)
    throw new AuthError(
      result.error.status === 429 ? 429 : 503,
      result.error.status === 429
        ? "Espera unos minutos antes de pedir otro enlace."
        : "No pudimos enviar el enlace. Inténtalo de nuevo en unos minutos.",
    );
  return response({
    message:
      "Si el correo está registrado, recibirás un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.",
  });
}

export async function beginPasswordRecovery(input: unknown) {
  const tokens = z
    .object({
      access_token: z.string().min(20).max(10000),
      refresh_token: z.string().min(6).max(2000),
      type: z.literal("recovery"),
    })
    .parse(input);
  const client = supabasePublic();
  const { data, error } = await client.auth.setSession(tokens);
  if (error || !data.session || !data.user)
    throw new AuthError(
      401,
      "El enlace no es válido o caducó. Solicita uno nuevo.",
    );
  const result = response({ ready: true });
  result.cookies.set(accessCookie, data.session.access_token, {
    ...cookies,
    maxAge: 600,
  });
  result.cookies.set(refreshCookie, data.session.refresh_token, {
    ...cookies,
    maxAge: 600,
  });
  return result;
}

export async function recoveryStatus(req: NextRequest) {
  const token = req.cookies.get(accessCookie)?.value;
  if (!token)
    throw new AuthError(
      401,
      "Abre el enlace que te enviamos por correo para continuar.",
    );
  const { data, error } = await supabasePublic().auth.getUser(token);
  if (error || !data.user)
    throw new AuthError(401, "El enlace caducó. Solicita uno nuevo.");
  return response({ ready: true });
}

export async function updateRecoveredPassword(
  req: NextRequest,
  input: unknown,
) {
  const { password, confirmation } = z
    .object({
      password: z.string().min(12).max(250),
      confirmation: z.string().max(250),
    })
    .parse(input);
  if (password !== confirmation)
    throw new AuthError(422, "Las contraseñas no coinciden.");
  const access_token = req.cookies.get(accessCookie)?.value;
  const refresh_token = req.cookies.get(refreshCookie)?.value;
  if (!access_token || !refresh_token)
    throw new AuthError(
      401,
      "Solicita un enlace nuevo para cambiar tu contraseña.",
    );
  const client = supabasePublic();
  const session = await client.auth.setSession({ access_token, refresh_token });
  if (session.error || !session.data.user)
    throw new AuthError(
      401,
      "El enlace no es válido o caducó. Solicita uno nuevo.",
    );
  // Revoke app sessions before changing the password; if storage is unavailable,
  // keep the existing password and allow a retry rather than leave sessions active.
  await transaction((state) => {
    state.sessions = state.sessions.filter(
      (s) => s.userId !== session.data.user!.id,
    );
  });
  const updated = await client.auth.updateUser({ password });
  if (updated.error)
    throw new AuthError(
      422,
      "No se pudo guardar la contraseña. Usa una diferente de al menos 12 caracteres o solicita un enlace nuevo.",
    );
  await client.auth.signOut({ scope: "global" }).catch(() => {});
  const result = response({
    message: "Contraseña actualizada. Inicia sesión con tu contraseña nueva.",
  });
  for (const name of [
    accessCookie,
    refreshCookie,
    "discovery_admin",
    "discovery_auth",
  ])
    result.cookies.set(name, "", { ...cookies, maxAge: 0 });
  return result;
}
