import { describe, expect, test } from "vitest";
import {
  describeModelSelection,
  getAgentTypeForAgentName,
  meetsModelRequirements,
  rankEligibleModels,
  selectModelForInvocation,
} from "../../../extensions/subagent/model-selector";
import type { ModelProfile } from "../../../extensions/subagent/model-policy";
import { validPolicyFixture } from "./model-policy-fixtures";

const rankedModels = validPolicyFixture.models as ModelProfile[];

describe("model selector", () => {
  test("filters by capability floor", () => {
    expect(
      meetsModelRequirements(rankedModels[0], { reasoning: "high", codingReliability: "high" }),
    ).toBe(false);
    expect(meetsModelRequirements(rankedModels[1], { reasoning: "high", codingReliability: "high" })).toBe(true);
  });

  test("ranks eligible models by cost tier then speed then stable tie-breaker", () => {
    const ranked = rankEligibleModels([
      { ...rankedModels[1], id: "balanced-b" },
      { ...rankedModels[1], id: "balanced-a" },
      rankedModels[2],
    ]);

    expect(ranked.map((model) => model.id)).toEqual(["balanced-a", "balanced-b", "deep-review"]);
  });

  test("preserves capability-first semantics", () => {
    const decision = selectModelForInvocation({
      policy: validPolicyFixture,
      agentType: "implementer",
      suggestedGrade: "light",
      finalGrade: "heavy",
    });

    expect(decision.selectedModel?.id).toBe("balanced");
    expect(decision.eligibleModels.map((model) => model.id)).not.toContain("cheap-fast");
  });

  test("falls back immediately to the next eligible model when the preferred one is unavailable", () => {
    const decision = selectModelForInvocation({
      policy: validPolicyFixture,
      agentType: "implementer",
      suggestedGrade: "standard",
      finalGrade: "heavy",
      isModelAvailable: (modelId) => modelId !== "balanced",
    });

    expect(decision.selectedModel?.id).toBe("deep-review");
    expect(decision.fallbackReason).toBe("balanced unavailable");
  });

  test("returns an explicit error when no eligible model exists", () => {
    const decision = selectModelForInvocation({
      policy: validPolicyFixture,
      agentType: "implementer",
      suggestedGrade: "heavy",
      finalGrade: "deep",
      isModelAvailable: () => false,
    });

    expect(decision.selectedModel).toBeUndefined();
    expect(decision.error).toBe("No eligible available model satisfies implementer/deep");
  });

  test("describes visible selection details", () => {
    const decision = selectModelForInvocation({
      policy: validPolicyFixture,
      agentType: "code-reviewer",
      suggestedGrade: "light",
      finalGrade: "deep",
      requestedModel: "manual-override",
    });

    expect(describeModelSelection("code-reviewer", decision)).toEqual({
      agentType: "code-reviewer",
      suggestedGrade: "light",
      finalGrade: "deep",
      selectedModel: "manual-override",
      overrideUsed: true,
      fallbackReason: undefined,
      selectionReason: "requested model override",
    });
  });

  test("maps bundled agent names to known agent types", () => {
    expect(getAgentTypeForAgentName("implementer")).toBe("implementer");
    expect(getAgentTypeForAgentName("code-reviewer")).toBe("code-reviewer");
    expect(getAgentTypeForAgentName("custom-reviewer")).toBeUndefined();
  });
});
