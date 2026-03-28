import { describe, expect, test } from "vitest";
import { classifyPromotionRisk, evaluatePolicy } from "../../../extensions/subagent/promotion";
import { baselinePolicyFixture, evalScenarioFixture } from "./policy-eval-fixtures";

describe("promotion and policy eval", () => {
  test("classifies low-risk reorderings vs review-required changes", () => {
    expect(classifyPromotionRisk({ kind: "reorder", sameCapabilityBand: true })).toBe("auto");
    expect(classifyPromotionRisk({ kind: "threshold-change" })).toBe("review");
    expect(classifyPromotionRisk({ kind: "model-reclassify" })).toBe("review");
  });

  test("compares cost scores against a baseline policy", () => {
    const cheaperPolicy = {
      ...baselinePolicyFixture,
      models: baselinePolicyFixture.models.map((model) =>
        model.id === "balanced" ? { ...model, costTier: "cheap" as const } : model,
      ),
    };

    const baseline = evaluatePolicy(baselinePolicyFixture, evalScenarioFixture);
    const candidate = evaluatePolicy(cheaperPolicy, evalScenarioFixture);

    expect(candidate.weightedCostScore).toBeLessThan(baseline.weightedCostScore);
    expect(candidate.floorViolations).toEqual([]);
  });

  test("detects floor violations when no eligible model satisfies a scenario", () => {
    const underpoweredPolicy = {
      ...baselinePolicyFixture,
      models: [{ ...baselinePolicyFixture.models[0] }],
    };

    const result = evaluatePolicy(underpoweredPolicy, [
      {
        name: "implementer-deep",
        agentType: "implementer",
        suggestedGrade: "deep",
        finalGrade: "deep",
      },
    ]);

    expect(result.floorViolations).toEqual(["implementer-deep: No eligible available model satisfies implementer/deep"]);
  });

  test("produces stable output for a fixed scenario corpus", () => {
    expect(evaluatePolicy(baselinePolicyFixture, evalScenarioFixture)).toEqual({
      weightedCostScore: 7,
      floorViolations: [],
      fallbackCount: 1,
      scenarios: [
        { name: "implementer-standard", selectedModel: "balanced", costTier: "moderate", fallbackUsed: false },
        { name: "code-reviewer-heavy", selectedModel: "deep-review", costTier: "expensive", fallbackUsed: false },
        { name: "worker-light-fallback", selectedModel: "balanced", costTier: "moderate", fallbackUsed: true },
      ],
    });
  });
});
