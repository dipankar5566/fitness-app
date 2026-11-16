import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./openai-provider.js";

// OpenAiProvider itself has no dedicated test beyond this - it's a thin wrapper around the real
// OpenAI SDK (same reasoning DatabaseService gets no direct test either), verified instead by the
// manual smoke tests against the real API. estimateCostUsd is the one piece of hand-written
// pricing math worth pinning down directly, since it's exactly the kind of arithmetic that's easy
// to get subtly wrong (e.g. forgetting the /1_000_000, or swapping the input/output rates).
describe("estimateCostUsd", () => {
  it("returns 0 for no tokens at all", () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });

  it("scales linearly with input tokens alone", () => {
    expect(estimateCostUsd(1_000_000, 0)).toBeCloseTo(0.15, 5);
  });

  it("scales linearly with output tokens alone", () => {
    expect(estimateCostUsd(0, 1_000_000)).toBeCloseTo(0.6, 5);
  });

  it("output tokens cost more per token than input tokens", () => {
    const inputOnly = estimateCostUsd(1000, 0);
    const outputOnly = estimateCostUsd(0, 1000);
    expect(outputOnly).toBeGreaterThan(inputOnly);
  });

  it("combines both rates for a typical small meal-parse call", () => {
    // ~200 input tokens, ~100 output tokens - a realistic single text-parse call.
    expect(estimateCostUsd(200, 100)).toBeCloseTo((200 * 0.15 + 100 * 0.6) / 1_000_000, 10);
  });
});
