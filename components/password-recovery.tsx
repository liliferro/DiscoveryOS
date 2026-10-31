"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, ArrowLeft, ArrowRight } from "lucide-react";
import { api, ApiRequestError } from "@/lib/client";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <RecoveryShell>
      <h1>Recupera tu acceso.</h1>
      <p>
        Escribe el correo de tu cuenta. Te enviaremos un enlace para elegir una
        contraseña nueva.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await api<{ message: string }>(
              "auth/recovery",
              "POST",
              { email },
            );
            setMessage(result.message);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Correo de tu cuenta
          <input
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <button className="button primary" disabled={busy || !!message}>
          {busy ? "Enviando enlace…" : "Enviar enlace de recuperación"}
          <ArrowRight size={16} />
        </button>
      </form>
      {message && (
        <button className="text-link" onClick={() => setMessage("")}>
          Usar otro correo
        </button>
      )}
    </RecoveryShell>
  );
}

export function ResetPassword() {
  const verification = useRef<Promise<unknown>>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!verification.current) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      // Remove credentials immediately and consume the link only once, including Strict Mode.
      window.history.replaceState(null, "", window.location.pathname);
      verification.current =
        params.has("error") || params.has("error_code")
          ? Promise.reject(
              Error("El enlace no es válido o caducó. Solicita uno nuevo."),
            )
          : params.get("access_token") &&
              params.get("refresh_token") &&
              params.get("type") === "recovery"
            ? api("auth/recovery-session", "POST", {
                access_token: params.get("access_token"),
                refresh_token: params.get("refresh_token"),
                type: "recovery",
              })
            : api("auth/recovery-session");
    }
    async function verify() {
      try {
        await verification.current;
        if (active) setReady(true);
      } catch (error) {
        if (active) setError((error as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, []);
  return (
    <RecoveryShell>
      <h1>Tu contraseña nueva.</h1>
      <p>
        Elige una contraseña de al menos 12 caracteres. Después podrás volver al
        panel.
      </p>
      {loading && <p role="status">Comprobando tu enlace…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message ? (
        <>
          <p role="status" className="success">
            {message}
          </p>
          <Link className="button primary" href="/agency">
            Iniciar sesión
            <ArrowRight size={16} />
          </Link>
        </>
      ) : ready ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            if (password !== confirmation) {
              setError("Las contraseñas no coinciden.");
              return;
            }
            setBusy(true);
            try {
              const result = await api<{ message: string }>(
                "auth/recovery-password",
                "POST",
                { password, confirmation },
              );
              setPassword("");
              setConfirmation("");
              setReady(false);
              setMessage(result.message);
            } catch (error) {
              if (error instanceof ApiRequestError && error.status === 401)
                setReady(false);
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Contraseña nueva
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={250}
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Repite la contraseña nueva
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={250}
              required
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar contraseña"}
            <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        !loading && (
          <Link className="button primary" href="/forgot-password">
            Solicitar un enlace nuevo
          </Link>
        )
      )}
    </RecoveryShell>
  );
}

function RecoveryShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="recovery-page">
      <section className="login-card recovery-card">
        <Link className="wordmark" href="/agency">
          <span className="logo">
            <AudioLines size={24} />
          </span>
          discovery<span className="os">OS</span>
        </Link>
        <span className="eyebrow">ACCESO A TU ESPACIO</span>
        {children}
        <Link className="text-link recovery-back" href="/agency">
          <ArrowLeft size={15} />
          Volver al acceso
        </Link>
      </section>
    </main>
  );
}
