import type { Run } from "./domain.ts";

export const dentalBookingUrl =
  "https://wa.me/525523153249?text=" +
  encodeURIComponent(
    "Hola, terminé mi discovery y me gustaría agendar una valoración con el equipo de la clínica.",
  );

// El resultado se prepara dentro de la misma transacción que guarda la conversación.
// Es una orientación de interés; no una determinación de candidaturas clínicas.
export function preparePatientResult(run: Run) {
  const c = run.conversation;
  if (!c?.closed || !c.decision || run.patientResult) return;
  run.patientResult = {
    createdAt: run.submittedAt || run.createdAt,
    status: "ready_for_review",
    options: c.decision.handoff
      ? []
      : c.decision.segments
          .filter((s) => s.interest !== "not_interested")
          .map(({ service, reason }) => ({ service, reason })),
    bookingUrl: c.decision.handoff ? "" : run.config.bookingUrl || "",
  };
}
