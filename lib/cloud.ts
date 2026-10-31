import { createClient } from "@supabase/supabase-js";
export function isCloud() {
  return (
    process.env.VERCEL === "1" || process.env.DISCOVERY_STORAGE === "supabase"
  );
}
export function cloudNamespace() {
  const namespace =
    process.env.DISCOVERY_NAMESPACE ||
    (process.env.VERCEL_ENV === "preview" ? "preview" : "production");
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(namespace))
    throw Error("CLOUD_INVALID_NAMESPACE");
  return namespace;
}
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("CLOUD_DATABASE_NOT_CONFIGURED");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw Error("CLOUD_AUTH_NOT_CONFIGURED");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
