// Diagnostic instrumentation helpers for lesson-quiz pipeline.
// Emits structured JSON logs — no prompts, no responses, no tokens, no PII.
// Does NOT change behavior, timeouts, retries, fallback or video selection.

export interface TraceCounters {
  traceId: string;
  totalRetries: number;
  fallbacks: number;
  videosRequested: number;
  videosProcessed: number;
  videosSkipped: number;
  sourceCounts: Record<string, number>;
  deepseekMainMs: number | null;
  deepseekReinforceMs: number | null;
  startedAt: number;
}

export function newTraceId(): string {
  // 12-char base36 id, sufficient to correlate a single request in logs.
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function newTrace(): TraceCounters {
  return {
    traceId: newTraceId(),
    totalRetries: 0,
    fallbacks: 0,
    videosRequested: 0,
    videosProcessed: 0,
    videosSkipped: 0,
    sourceCounts: {},
    deepseekMainMs: null,
    deepseekReinforceMs: null,
    startedAt: performance.now(),
  };
}

// Redact a youtubeId to first 3 + last 2 chars ("abc***xy") — enough to
// spot-check, insufficient to reconstruct the URL from log alone.
export function maskYoutubeId(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  const s = String(id);
  if (s.length <= 6) return `${s.slice(0, 1)}***`;
  return `${s.slice(0, 3)}***${s.slice(-2)}`;
}

// Only fixed enum values reach logs — never user input, prompt or response body.
export type StepStatus = "ok" | "error" | "miss" | "hit" | "skip";

export interface StepLog {
  evt: "lesson-quiz.step";
  traceId: string;
  step: string;
  status: StepStatus;
  durationMs: number;
  model?: string;
  attempt?: number;
  errorType?: string;
  youtubeId?: string;
}

export function logStep(entry: Omit<StepLog, "evt">): void {
  const payload: StepLog = { evt: "lesson-quiz.step", ...entry };
  // Round to avoid noisy decimals in logs.
  payload.durationMs = Math.round(payload.durationMs);
  try {
    console.log(JSON.stringify(payload));
  } catch {
    // never let logging throw
  }
}

export interface SummaryLog {
  evt: "lesson-quiz.summary";
  traceId: string;
  totalMs: number;
  videosRequested: number;
  videosProcessed: number;
  videosSkipped: number;
  sourceCounts: Record<string, number>;
  deepseekMainMs: number | null;
  deepseekReinforceMs: number | null;
  totalRetries: number;
  fallbacks: number;
  outcome: "ok" | "error";
  errorType?: string;
}

export function logSummary(entry: Omit<SummaryLog, "evt">): void {
  const payload: SummaryLog = { evt: "lesson-quiz.summary", ...entry };
  payload.totalMs = Math.round(payload.totalMs);
  try {
    console.log(JSON.stringify(payload));
  } catch {
    // never let logging throw
  }
}

// Classify an error into a coarse type WITHOUT leaking its message body.
// We only look at a small allowlist of known error prefixes emitted by our
// own callers — anything else is bucketed as "unknown".
export function classifyErrorType(err: unknown): string {
  if (!(err instanceof Error)) return "unknown";
  const m = err.message;
  const known = [
    "google_timeout_",
    "google_forbidden",
    "google_bad_request",
    "google_blocked",
    "google_empty",
    "google_",
    "rate_limit",
    "deepseek_rate_limit",
    "deepseek_insufficient_balance",
    "deepseek_forbidden",
    "deepseek_network",
    "deepseek_empty",
    "deepseek_",
    "supadata_forbidden",
    "supadata_rate_limit",
    "supadata_not_found",
    "supadata_empty",
    "supadata_network",
    "supadata_",
    "gemini_no_content",
    "gemini_failed",
  ];
  for (const prefix of known) {
    if (m.startsWith(prefix)) return prefix.replace(/_$/, "");
  }
  return "unknown";
}
