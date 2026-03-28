import type { SubagentModelPolicy } from "../../../extensions/subagent/model-policy";

export const validPolicyFixture: SubagentModelPolicy = {
  models: [
    {
      id: "cheap-fast",
      reasoning: "medium",
      codingReliability: "medium",
      reviewDepth: "medium",
      speed: "very_fast",
      costTier: "cheap",
    },
    {
      id: "balanced",
      reasoning: "high",
      codingReliability: "high",
      reviewDepth: "high",
      speed: "fast",
      costTier: "moderate",
    },
    {
      id: "deep-review",
      reasoning: "very_high",
      codingReliability: "high",
      reviewDepth: "very_high",
      speed: "medium",
      costTier: "expensive",
    },
  ],
  overlays: {
    implementer: {
      light: { codingReliability: "medium", reasoning: "medium" },
      standard: { codingReliability: "high", reasoning: "medium" },
      heavy: { codingReliability: "high", reasoning: "high" },
      deep: { codingReliability: "high", reasoning: "very_high" },
    },
    worker: {
      light: { reasoning: "medium" },
      standard: { reasoning: "medium", codingReliability: "medium" },
      heavy: { reasoning: "high", codingReliability: "medium" },
      deep: { reasoning: "high", codingReliability: "high" },
    },
    "spec-reviewer": {
      light: { reasoning: "medium", reviewDepth: "medium" },
      standard: { reasoning: "high", reviewDepth: "high" },
      heavy: { reasoning: "high", reviewDepth: "high" },
      deep: { reasoning: "very_high", reviewDepth: "very_high" },
    },
    "code-reviewer": {
      light: { reasoning: "medium", reviewDepth: "medium" },
      standard: { reasoning: "high", reviewDepth: "high" },
      heavy: { reasoning: "high", reviewDepth: "very_high" },
      deep: { reasoning: "very_high", reviewDepth: "very_high" },
    },
  },
};
