import { transaction } from "./store.ts";
import { stages, scoreAnswers } from "./domain.ts";
import { researchProvider, diagnosticProvider } from "./providers.ts";
export async function processJobStep(runId?: string, immediate = false) {
  return transaction((state) => {
    const run = state.runs.find(
      (r) =>
        r.state === "processing" &&
        r.job &&
        r.job.nextAt <= Date.now() &&
        (!runId || r.id === runId),
    );
    if (!run?.job) return false;
    const job = run.job;
    try {
      if (job.stage === 1 && job.scenario === "timeout" && job.attempts === 0)
        throw Error("SIMULATED_TIMEOUT");
      if (job.stage === 1 && job.scenario === "unavailable")
        throw Error("SIMULATED_UNAVAILABLE");
      if (job.stage === 1) job.sources = researchProvider.extract(run.answers);
      if (job.stage === 2) job.score = scoreAnswers(run.answers);
      if (job.stage === 3) {
        if (!job.score) throw Error("SCORE_CHECKPOINT_MISSING");
        run.report = {
          ...diagnosticProvider.generate(
            run.answers,
            state.tenants.find((t) => t.id === run.tenantId)!,
            job.sources,
          ),
          ...job.score,
        };
      }
      if (job.stage === 4) {
        if (
          !run.report ||
          run.report.findings.some(
            (f) =>
              f.sourceId &&
              !run.report!.sources.some((s) => s.id === f.sourceId),
          )
        )
          throw Error("INVALID_REPORT");
        run.state = "completed_limited";
      }
      job.stage = Math.min(job.stage + 1, stages.length);
      job.error = undefined;
      job.nextAt = Date.now() + (immediate ? 0 : 1000);
    } catch (e) {
      job.attempts++;
      job.error = e instanceof Error ? e.message : "PROVIDER_ERROR";
      job.nextAt = Date.now() + job.attempts * 1500;
      if (job.attempts >= 3) run.state = "failed";
    }
    return true;
  });
}
export async function processLegacyRun(runId: string) {
  for (let i = 0; i < 5; i++) if (!(await processJobStep(runId, true))) break;
}
