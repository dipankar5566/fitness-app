import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./openai-provider.js";

// OpenAiProvider itself has no dedicated test beyond this - it's a thin wrapper around the real
// OpenAI SDK (same reasoning DatabaseService gets no direct test either), verified instead by the
// manual smoke tests against the real API. estimateCostUsd is the one piece of hand-written
// pricing math worth pinning down directly, since it's exactly the kind of arithmetic that's easy
// to get subtly wrong (e.g. forgetting the /1_000_000, or swapping the input/output rates).
describe("estimateCostUsd", () => {
  it("returns 0 for no tokens at all", () => {
    expect(estimateCostUsd("gpt-4o-mini", 0, 0)).toBe(0);
  });

  it("scales linearly with input tokens alone", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 0)).toBeCloseTo(0.15, 5);
  });

  it("scales linearly with output tokens alone", () => {
    expect(estimateCostUsd("gpt-4o-mini", 0, 1_000_000)).toBeCloseTo(0.6, 5);
  });

  it("output tokens cost more per token than input tokens", () => {
    const inputOnly = estimateCostUsd("gpt-4o-mini", 1000, 0);
    const outputOnly = estimateCostUsd("gpt-4o-mini", 0, 1000);
    expect(outputOnly).toBeGreaterThan(inputOnly);
  });

  it("combines both rates for a typical small meal-parse call", () => {
    // ~200 input tokens, ~100 output tokens - a realistic single text-parse call.
    expect(estimateCostUsd("gpt-4o-mini", 200, 100)).toBeCloseTo((200 * 0.15 + 100 * 0.6) / 1_000_000, 10);
  });

  it("uses gpt-4o's materially higher rates for the coach model", () => {
    expect(estimateCostUsd("gpt-4o", 1_000_000, 0)).toBeCloseTo(2.5, 5);
    expect(estimateCostUsd("gpt-4o", 0, 1_000_000)).toBeCloseTo(10, 5);
  });

  it("throws for an unconfigured model rather than silently returning 0", () => {
    expect(() => estimateCostUsd("some-other-model", 100, 100)).toThrow(/no pricing/i);
  });
});
