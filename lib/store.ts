import { seed, dentalTenant } from "./seed.ts";
import type { Run, Tenant } from "./domain.ts";
import type { AiConnection } from "./ai-settings.ts";
import { isCloud, supabaseServer, cloudNamespace } from "./cloud.ts";
export type State = {
  tenants: Tenant[];
  runs: Run[];
  sessions: {
    hash: string;
    tenantId: string;
    expiresAt: number;
    userId?: string;
  }[];
  aiConnections?: Record<string, AiConnection>;
  aiDaily?: Record<string, number>;
};
export function initialState(): State {
  return { tenants: seed(), runs: [], sessions: [] };
}
function migrate(state: State) {
  if (!state.tenants.some((t) => t.id === "dental"))
    state.tenants.push(dentalTenant());
}
export async function transaction<T>(fn: (state: State) => T): Promise<T> {
  if (!isCloud()) {
    const { localTransaction } = await import("./local-store.ts");
    return localTransaction((state) => {
      migrate(state);
      return fn(state);
    });
  }
  const client = supabaseServer();
  const id = cloudNamespace();
  for (let attempt = 0; attempt < 10; attempt++) {
    const read = await client
      .from("discovery_app_state")
      .select("revision,value")
      .eq("id", id)
      .maybeSingle();
    if (read.error) throw Error("CLOUD_DATABASE_UNAVAILABLE");
    if (!read.data) {
      const inserted = await client
        .from("discovery_app_state")
        .upsert(
          { id, revision: 0, value: initialState() },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (inserted.error) throw Error("CLOUD_DATABASE_UNAVAILABLE");
      continue;
    }
    const state = structuredClone(read.data.value) as State;
    const before = JSON.stringify(state);
    migrate(state);
    const result = fn(state);
    if (result instanceof Promise) throw Error("ASYNC_TRANSACTION_CALLBACK");
    if (JSON.stringify(state) === before) return result;
    const write = await client
      .from("discovery_app_state")
      .update({
        value: state,
        revision: read.data.revision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("revision", read.data.revision)
      .select("revision");
    if (write.error) throw Error("CLOUD_DATABASE_UNAVAILABLE");
    if (write.data?.length === 1) return result;
    await new Promise((resolve) =>
      setTimeout(resolve, 10 + Math.random() * 40),
    );
  }
  throw Error("CLOUD_WRITE_CONFLICT");
}
