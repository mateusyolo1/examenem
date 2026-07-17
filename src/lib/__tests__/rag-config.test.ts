import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  clampMatchCount,
  assertValidThreshold,
  getRagMinSimilarity,
  RAG_IS_CALIBRATED,
} from "../rag-config";

describe("rag-config", () => {
  const original = { NODE_ENV: process.env.NODE_ENV, TEST_RAG_MIN_SIMILARITY: process.env.TEST_RAG_MIN_SIMILARITY };
  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    if (original.TEST_RAG_MIN_SIMILARITY === undefined) delete process.env.TEST_RAG_MIN_SIMILARITY;
    else process.env.TEST_RAG_MIN_SIMILARITY = original.TEST_RAG_MIN_SIMILARITY;
  });

  it("clampMatchCount respeita [1,20] e default 6", () => {
    expect(clampMatchCount(undefined)).toBe(6);
    expect(clampMatchCount(0)).toBe(1);
    expect(clampMatchCount(999)).toBe(20);
    expect(clampMatchCount(7.9)).toBe(7);
  });

  it("assertValidThreshold lança fora de [-1,1]", () => {
    expect(() => assertValidThreshold(0)).not.toThrow();
    expect(() => assertValidThreshold(-1)).not.toThrow();
    expect(() => assertValidThreshold(1)).not.toThrow();
    expect(() => assertValidThreshold(1.01)).toThrow();
    expect(() => assertValidThreshold(Number.NaN)).toThrow();
  });

  it("RAG_IS_CALIBRATED é false no Bloco 1", () => {
    expect(RAG_IS_CALIBRATED).toBe(false);
  });

  it("getRagMinSimilarity retorna null em produção enquanto uncalibrated", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TEST_RAG_MIN_SIMILARITY;
    expect(getRagMinSimilarity()).toBeNull();
  });

  it("getRagMinSimilarity aceita override APENAS em NODE_ENV=test", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_RAG_MIN_SIMILARITY = "0.72";
    expect(getRagMinSimilarity()).toBe(0.72);

    process.env.NODE_ENV = "production";
    process.env.TEST_RAG_MIN_SIMILARITY = "0.72";
    expect(getRagMinSimilarity()).toBeNull();
  });
});
