import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { isCloud } from "./cloud.ts";
export type AiConnection = {
  cipher?: string;
  model: string;
  enabled: boolean;
  verified: boolean;
  dailyLimit: number;
};
export function testFixtureEnabled() {
  return (
    process.env.DISCOVERY_TEST_AI === "1" &&
    process.env.NODE_ENV !== "production" &&
    /^e2e-/.test(process.env.DISCOVERY_DB_FILE || "")
  );
}
export const connectionSchema = z.object({
  apiKey: z.string().max(500).optional(),
  model: z.string().regex(/^[a-zA-Z0-9._-]{3,100}$/),
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(5).max(1000),
});
function vaultKey() {
  if (process.env.APP_ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.APP_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) throw Error("INVALID_APP_ENCRYPTION_KEY");
    return key;
  }
  if (isCloud()) throw Error("CLOUD_KEY_VAULT_REQUIRES_APP_ENCRYPTION_KEY");
  const folder = join(process.cwd(), ".data");
  mkdirSync(folder, { recursive: true });
  const file = join(folder, "vault.key");
  if (!existsSync(file)) {
    try {
      writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch {
      if (!existsSync(file)) throw Error("VAULT_UNAVAILABLE");
    }
  }
  return readFileSync(file);
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decryptSecret(secret: string) {
  const buffer = Buffer.from(secret, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    vaultKey(),
    buffer.subarray(0, 12),
  );
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function connectionKey(connection: AiConnection) {
  return connection.cipher
    ? decryptSecret(connection.cipher)
    : process.env.OPENAI_API_KEY || "";
}
export function defaultConnection(): AiConnection {
  return {
    model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
    enabled: isCloud() && !!process.env.OPENAI_API_KEY,
    verified: false,
    dailyLimit: 100,
  };
}
export function connectionView(connection: AiConnection) {
  return {
    model: connection.model,
    enabled: connection.enabled,
    verified: connection.verified,
    dailyLimit: connection.dailyLimit,
    configured: !!connection.cipher || !!process.env.OPENAI_API_KEY,
    environmentManaged: isCloud() && !process.env.APP_ENCRYPTION_KEY,
  };
}
