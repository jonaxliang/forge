import type { WorkflowReviewMode } from "./workflow-file.js";

export const exitReviewVerdicts = [
  "pending",
  "passed",
  "failed",
  "skipped"
] as const;

export type ExitReviewVerdict = (typeof exitReviewVerdicts)[number];

export type ExitReviewCriterionResult = {
  criterion: string;
  evidence: string;
  passed: boolean;
};

export type ExitReviewResult = {
  criteria: ExitReviewCriterionResult[];
  feedback: string;
  mode: WorkflowReviewMode;
  reviewedAt: string | null;
  reviewer: "model" | "human" | "none";
  summary: string;
  verdict: ExitReviewVerdict;
};

export type NodeRunAttempt = {
  attempt: number;
  completedAt: string;
  errorMessage: string | null;
  output: string | null;
  review: ExitReviewResult | null;
};

export type ExitReviewTransition = "passed" | "retry" | "blocked" | "waiting";

export function getExitReviewTransition({
  maxRetries,
  retryCount,
  verdict
}: {
  maxRetries: number;
  retryCount: number;
  verdict: ExitReviewVerdict;
}): ExitReviewTransition {
  if (verdict === "pending") {
    return "waiting";
  }

  if (verdict === "passed" || verdict === "skipped") {
    return "passed";
  }

  return retryCount < maxRetries ? "retry" : "blocked";
}
