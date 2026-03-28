import { describe, expect, test } from "vitest";
import {
  CAPABILITY_LEVELS,
  COST_TIERS,
  SPEED_LEVELS,
  compareCapabilityLevel,
  compareCostTier,
  compareSpeedLevel,
  resolveModelRequirements,
  validateModelPolicy,
} from "../../../extensions/subagent/model-policy";
import { validPolicyFixture } from "./model-policy-fixtures";

describe("model policy", () => {
  test("exports ordered vocabularies for shared model profiles", () => {
    expect(CAPABILITY_LEVELS).toEqual(["low", "medium", "high", "very_high"]);
    expect(SPEED_LEVELS).toEqual(["slow", "medium", "fast", "very_fast"]);
    expect(COST_TIERS).toEqual(["cheap", "moderate", "expensive", "premium"]);
  });

  test("compares capability levels by declared order", () => {
    expect(compareCapabilityLevel("medium", "low")).toBeGreaterThan(0);
    expect(compareCapabilityLevel("high", "high")).toBe(0);
    expect(compareCapabilityLevel("low", "very_high")).toBeLessThan(0);
  });

  test("compares speed and cost tiers by declared order", () => {
    expect(compareSpeedLevel("very_fast", "fast")).toBeGreaterThan(0);
    expect(compareCostTier("cheap", "premium")).toBeLessThan(0);
  });

  test("resolves per-agent overlays by agent type and grade", () => {
    expect(resolveModelRequirements(validPolicyFixture, "implementer", "heavy")).toEqual({
      codingReliability: "high",
      reasoning: "high",
    });
    expect(resolveModelRequirements(validPolicyFixture, "code-reviewer", "deep")).toEqual({
      reasoning: "very_high",
      reviewDepth: "very_high",
    });
  });

  test("validates a well-formed policy fixture", () => {
    expect(validateModelPolicy(validPolicyFixture)).toEqual([]);
  });

  test("rejects malformed policy entries", () => {
    const invalidPolicy = {
      ...validPolicyFixture,
      models: [
        {
          id: "broken",
          reasoning: "ultra",
          codingReliability: "medium",
          reviewDepth: "medium",
          speed: "fast",
          costTier: "cheap",
        },
      ],
      overlays: {
        ...validPolicyFixture.overlays,
        implementer: {
          ...validPolicyFixture.overlays.implementer,
          heavy: { codingReliability: "legendary" },
        },
      },
    } as any;

    expect(validateModelPolicy(invalidPolicy)).toEqual([
      "models[0].reasoning must be one of: low, medium, high, very_high",
      "overlays.implementer.heavy.codingReliability must be one of: low, medium, high, very_high",
    ]);
  });
});
