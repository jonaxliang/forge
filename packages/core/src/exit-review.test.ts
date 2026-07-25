import { describe, expect, it } from "vitest";
import { getExitReviewTransition } from "./exit-review.js";

describe("Exit Review transition", () => {
  it("passes approved and skipped reviews", () => {
    expect(
      getExitReviewTransition({ maxRetries: 2, retryCount: 0, verdict: "passed" })
    ).toBe("passed");
    expect(
      getExitReviewTransition({ maxRetries: 2, retryCount: 0, verdict: "skipped" })
    ).toBe("passed");
  });

  it("retries failed reviews within the retry budget", () => {
    expect(
      getExitReviewTransition({ maxRetries: 2, retryCount: 0, verdict: "failed" })
    ).toBe("retry");
    expect(
      getExitReviewTransition({ maxRetries: 2, retryCount: 1, verdict: "failed" })
    ).toBe("retry");
  });

  it("blocks failed reviews after the retry budget is exhausted", () => {
    expect(
      getExitReviewTransition({ maxRetries: 2, retryCount: 2, verdict: "failed" })
    ).toBe("blocked");
  });

  it("waits for pending human review", () => {
    expect(
      getExitReviewTransition({ maxRetries: 1, retryCount: 0, verdict: "pending" })
    ).toBe("waiting");
  });
});
