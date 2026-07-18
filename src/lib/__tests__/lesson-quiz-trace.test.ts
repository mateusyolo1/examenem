import { describe, it, expect } from "bun:test";
import {
  classifyErrorType,
  logStep,
  logSummary,
  maskYoutubeId,
  newTrace,
  newTraceId,
} from "../lesson-quiz-trace.server";

// Helper: capture what logStep/logSummary write to console.log.
function captureLog(fn: () => void): string[] {
  const orig = console.log;
  const buf: string[] = [];
  console.log = (...args: unknown[]) => {
    buf.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return buf;
}

// Tokens/PII/prompt substrings we must never emit in a diagnostic log.
const FORBIDDEN_SUBSTRINGS = [
  // Prompt/response body fragments seen in this pipeline:
  "Você é",
  "keyConcepts",
  "TRANSCRIÇÃO",
  "RESUMOS",
  "system",
  // OAuth/API-key/JWT-ish shapes and bearer tokens:
  "Bearer ",
  "sk-",
  "sb_secret_",
  "sb_publishable_",
  "eyJ",
  // Emails:
  "@",
];

function assertNoSensitiveContent(line: string): void {
  for (const s of FORBIDDEN_SUBSTRINGS) {
    expect(line.includes(s)).toBe(false);
  }
}

describe("lesson-quiz-trace", () => {
  it("newTraceId returns a unique-ish short id", () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(6);
    expect(a).not.toBe(b);
  });

  it("newTrace initializes counters to zero and captures startedAt", () => {
    const t = newTrace();
    expect(t.totalRetries).toBe(0);
    expect(t.fallbacks).toBe(0);
    expect(t.videosRequested).toBe(0);
    expect(t.videosProcessed).toBe(0);
    expect(t.videosSkipped).toBe(0);
    expect(t.deepseekMainMs).toBeNull();
    expect(t.deepseekReinforceMs).toBeNull();
    expect(t.sourceCounts).toEqual({});
    expect(typeof t.startedAt).toBe("number");
  });

  it("maskYoutubeId hides the middle of a normal YouTube id", () => {
    expect(maskYoutubeId("dQw4w9WgXcQ")).toBe("dQw***cQ");
    expect(maskYoutubeId("")).toBeUndefined();
    expect(maskYoutubeId(undefined)).toBeUndefined();
    expect(maskYoutubeId("abc")).toBe("a***");
  });

  it("classifyErrorType maps known prefixes and buckets unknowns", () => {
    expect(classifyErrorType(new Error("google_timeout_8000ms"))).toBe("google_timeout");
    expect(classifyErrorType(new Error("deepseek_forbidden: bad key"))).toBe("deepseek_forbidden");
    expect(classifyErrorType(new Error("supadata_not_found"))).toBe("supadata_not_found");
    expect(classifyErrorType(new Error("kaboom something private"))).toBe("unknown");
    expect(classifyErrorType("not an error")).toBe("unknown");
  });

  it("logStep only serializes whitelisted fields; no prompt/response/token/email leaks", () => {
    const lines = captureLog(() => {
      logStep({
        traceId: "trace-xyz",
        step: "gemini-yt",
        status: "ok",
        durationMs: 1234.7,
        model: "gemini-2.5-flash",
        attempt: 0,
        youtubeId: "dQw***cQ",
      });
      logStep({
        traceId: "trace-xyz",
        step: "deepseek-main",
        status: "error",
        durationMs: 42,
        model: "deepseek-chat",
        attempt: 2,
        errorType: "deepseek_rate_limit",
      });
    });

    expect(lines.length).toBe(2);
    for (const line of lines) {
      assertNoSensitiveContent(line);
      const parsed = JSON.parse(line);
      expect(parsed.evt).toBe("lesson-quiz.step");
      const allowed = new Set([
        "evt",
        "traceId",
        "step",
        "status",
        "durationMs",
        "model",
        "attempt",
        "errorType",
        "youtubeId",
      ]);
      for (const k of Object.keys(parsed)) {
        expect(allowed.has(k)).toBe(true);
      }
      // durationMs rounded to integer
      expect(Number.isInteger(parsed.durationMs)).toBe(true);
    }
  });

  it("logSummary only serializes whitelisted fields; no leaks", () => {
    const lines = captureLog(() => {
      logSummary({
        traceId: "trace-xyz",
        totalMs: 12345.9,
        videosRequested: 3,
        videosProcessed: 2,
        videosSkipped: 1,
        sourceCounts: { "gemini-yt": 1, supadata: 1 },
        deepseekMainMs: 900,
        deepseekReinforceMs: null,
        totalRetries: 1,
        fallbacks: 1,
        outcome: "ok",
      });
    });

    expect(lines.length).toBe(1);
    const line = lines[0];
    assertNoSensitiveContent(line);
    const parsed = JSON.parse(line);
    expect(parsed.evt).toBe("lesson-quiz.summary");
    const allowed = new Set([
      "evt",
      "traceId",
      "totalMs",
      "videosRequested",
      "videosProcessed",
      "videosSkipped",
      "sourceCounts",
      "deepseekMainMs",
      "deepseekReinforceMs",
      "totalRetries",
      "fallbacks",
      "outcome",
      "errorType",
    ]);
    for (const k of Object.keys(parsed)) {
      expect(allowed.has(k)).toBe(true);
    }
    expect(Number.isInteger(parsed.totalMs)).toBe(true);
  });
});
