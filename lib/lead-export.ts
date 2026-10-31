import type { State } from "./store.ts";
import { AgencyError } from "./agency.ts";
import { z } from "zod";

// Las respuestas son texto no confiable, incluso al abrir el archivo en Excel.
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))
    text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportLeads(state: State, input: unknown) {
  const scope = z
    .object({
      clientId: z.string().min(1).max(80).optional(),
      landingId: z.string().min(1).max(80).optional(),
    })
    .strict()
    .parse(input);
  if (
    scope.clientId &&
    !state.clients?.some((client) => client.id === scope.clientId)
  )
    throw new AgencyError(404, "Cliente no disponible");
  if (
    scope.landingId &&
    !state.tenants.some(
      (landing) =>
        landing.id === scope.landingId &&
        (!scope.clientId || landing.clientId === scope.clientId),
    )
  )
    throw new AgencyError(404, "Landing no disponible");
  const landings = state.tenants.filter(
    (landing) =>
      (!scope.clientId || landing.clientId === scope.clientId) &&
      (!scope.landingId || landing.id === scope.landingId),
  );
  const ids = new Set(landings.map((landing) => landing.id));
  const rows: unknown[][] = [
    [
      "Cliente",
      "Landing",
      "Enlace",
      "Objetivo",
      "ID de sesión",
      "Creada (UTC)",
      "Finalizada (UTC)",
      "Estado",
      "Resumen",
      "Servicios de interés",
      "Perfil (JSON)",
      "Conversación (JSON)",
      "Respuestas de formulario (JSON)",
    ],
  ];
  for (const run of state.runs.filter((run) => ids.has(run.tenantId))) {
    const landing = landings.find((item) => item.id === run.tenantId)!;
    const client = state.clients?.find((item) => item.id === landing.clientId);
    const decision = run.conversation?.decision;
    rows.push([
      client?.name || run.brand.name,
      landing.landingName || run.config.title,
      `/s/${landing.slug}`,
      run.config.discovery?.objective || "Cuestionario predefinido",
      run.id,
      run.createdAt,
      run.submittedAt || "",
      run.conversation?.closed
        ? "Completada"
        : run.state === "draft"
          ? "En curso"
          : run.state,
      run.conversation?.closed
        ? decision?.summary || ""
        : run.report?.summary || "",
      decision?.segments
        .filter((segment) => segment.interest !== "not_interested")
        .map((segment) => segment.service)
        .join("; ") || "",
      decision ? JSON.stringify(decision.profile) : "",
      run.conversation
        ? JSON.stringify(
            run.conversation.turns.map((turn) => ({
              question: turn.question.text,
              answer: turn.answer ?? null,
            })),
          )
        : "",
      JSON.stringify(run.answers),
    ]);
  }
  return {
    filename: "discovery-resultados.csv",
    csv:
      "\uFEFF" +
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
      "\r\n",
  };
}
