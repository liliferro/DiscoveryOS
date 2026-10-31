export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/v1/" + path, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(70000),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw Error(
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "La respuesta está tardando más de lo esperado. Puedes reintentar; tus respuestas enviadas siguen guardadas."
        : "No pudimos conectar. Revisa tu conexión a internet y vuelve a intentarlo.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiRequestError(
      typeof data?.message === "string"
        ? data.message
        : response.status === 401
          ? "Tu sesión caducó. Vuelve a iniciar sesión."
          : "El servicio no pudo responder. Espera unos segundos y vuelve a intentarlo.",
      response.status,
    );
  return data as T;
}
