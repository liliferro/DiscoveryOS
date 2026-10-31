"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
type Connection = {
  provider?: "openai" | "anthropic";
  model: string;
  configured: boolean;
  enabled: boolean;
  verified: boolean;
  dailyLimit: number;
  environmentManaged?: boolean;
};
export default function AiConnectionPanel() {
  const [data, setData] = useState<Connection>();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<Connection>("admin/connection")
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar la conexión.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await api<Connection>("admin/connection", "PUT", {
        provider: data.provider || "openai",
        model: data.model,
        enabled: data.enabled,
        dailyLimit: data.dailyLimit,
        apiKey: key || undefined,
      });
      setData(next);
      setKey("");
      setMessage("Conexión guardada. Puedes comprobar el acceso al modelo.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("admin/connection-test", "POST", {});
      setData(await api<Connection>("admin/connection"));
      setMessage(
        "Conexión comprobada: la clave tiene acceso al modelo. Inicia una discovery para probar la generación.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card editor ai-connection">
      <div className="eyebrow">
        MOTOR CONVERSACIONAL /{" "}
        {data?.provider === "anthropic" ? "CLAUDE" : "OPENAI"}
      </div>
      <h2>Conecta la inteligencia de tu discovery.</h2>
      <p className="muted">
        Cada empresa tiene su propia conexión. Las llamadas salen del servidor;
        la clave nunca se entrega al visitante.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      {data && (
        <>
          <span className="tag">
            {data.enabled && data.configured
              ? "IA real activada"
              : data.configured
                ? "Clave guardada · conexión desactivada"
                : "Pendiente de clave"}
            {data.verified ? " · acceso comprobado" : ""}
          </span>
          <label>
            Proveedor
            <select
              value={data.provider || "openai"}
              onChange={(e) => {
                const provider = e.target.value as "openai" | "anthropic";
                setData({
                  ...data,
                  provider,
                  model:
                    provider === "anthropic"
                      ? "claude-sonnet-5-5"
                      : "gpt-6.1-terra",
                });
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude · Anthropic</option>
            </select>
          </label>
          <label>
            Clave de API del proveedor
            <input
              autoComplete="off"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                data.configured
                  ? "Clave guardada · escribe otra solo para reemplazarla"
                  : "Introduce tu clave de API"
              }
              disabled={data.environmentManaged}
            />
          </label>
          <label>
            Modelo
            <input
              value={data.model}
              onChange={(e) => setData({ ...data, model: e.target.value })}
            />
          </label>
          <label>
            Límite diario de solicitudes por empresa
            <input
              type="number"
              min={5}
              max={1000}
              value={data.dailyLimit}
              onChange={(e) =>
                setData({ ...data, dailyLimit: Number(e.target.value) })
              }
            />
          </label>
          <p className="small muted">
            Se reservan dos solicitudes por turno para cubrir un posible
            reintento. El límite es por día UTC. Las llamadas usan el saldo de
            tu cuenta de API.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={(e) => setData({ ...data, enabled: e.target.checked })}
            />
            Activar la IA para las sesiones adaptativas de esta empresa
          </label>
          <div className="editor-actions">
            <button
              className="button secondary"
              disabled={busy || !data.configured}
              onClick={test}
            >
              Comprobar conexión guardada
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              Guardar conexión
            </button>
          </div>
          <p className="muted small">
            Configuración local: la clave se cifra en disco. Este entorno
            conserva acceso administrativo de demostración; utiliza personas
            ficticias para probarlo.
          </p>
        </>
      )}
    </section>
  );
}
