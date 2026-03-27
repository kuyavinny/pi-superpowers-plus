import type { Phase, TransitionBoundary } from "./workflow-tracker";
import type { GoalExecutionMode } from "./goal-artifacts";

export type TransitionChoice = "next" | "fresh" | "skip" | "discuss";

export interface TransitionPrompt {
  boundary: TransitionBoundary;
  title: string;
  nextPhase: Phase;
  artifactPath: string | null;
  options: { choice: TransitionChoice; label: string }[];
}

export interface TransitionPromptContext {
  executionMode?: GoalExecutionMode;
}

const BASE_OPTIONS: TransitionPrompt["options"] = [
  { choice: "next", label: "Next step (this session)" },
  { choice: "fresh", label: "Fresh session → next step" },
  { choice: "skip", label: "Skip" },
  { choice: "discuss", label: "Discuss" },
];

export function getTransitionPrompt(
  boundary: TransitionBoundary,
  artifactPath: string | null,
  context: TransitionPromptContext = {},
): TransitionPrompt {
  switch (boundary) {
    case "design_committed":
      return {
        boundary,
        title: "Design committed. What next?",
        nextPhase: "plan",
        artifactPath,
        options: BASE_OPTIONS,
      };
    case "plan_ready":
      return {
        boundary,
        title: context.executionMode === "autoresearch"
          ? "Plan ready for autoresearch. What next?"
          : "Plan ready. What next?",
        nextPhase: "execute",
        artifactPath,
        options: BASE_OPTIONS,
      };
    case "execution_complete":
      return {
        boundary,
        title: "Execution complete. What next?",
        nextPhase: "verify",
        artifactPath,
        options: BASE_OPTIONS,
      };
    case "verification_passed":
      return {
        boundary,
        title: "Verification passed. What next?",
        nextPhase: "review",
        artifactPath,
        options: BASE_OPTIONS,
      };
    case "review_complete":
      return {
        boundary,
        title: "Review complete. What next?",
        nextPhase: "finish",
        artifactPath,
        options: BASE_OPTIONS,
      };
    default:
      return {
        boundary,
        title: "What next?",
        nextPhase: "plan",
        artifactPath,
        options: BASE_OPTIONS,
      };
  }
}
