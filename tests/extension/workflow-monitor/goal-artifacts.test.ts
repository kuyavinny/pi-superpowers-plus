import { describe, expect, test } from "vitest";
import { parseGoalArtifact, REQUIRED_GOAL_SECTIONS } from "../../../extensions/workflow-monitor/goal-artifacts";

describe("parseGoalArtifact", () => {
  test("extracts execution mode and finds no missing sections in a complete implementation plan", () => {
    const markdown = `# Feature Implementation Plan

**Execution Mode:** autoresearch

## Goal Summary
- **Objective:** Reduce benchmark runtime
- **Why it matters:** Faster local feedback
- **Constraints:** No correctness regressions
- **Success signals:** Median runtime drops
- **Verification checks:** Relevant tests pass
- **Scope / Off-limits:** Only benchmark harness files
- **Stop conditions:** Stop when improvements are within noise
`;

    expect(parseGoalArtifact(markdown)).toEqual({
      missingSections: [],
      executionMode: "autoresearch",
    });
  });

  test("reports missing required sections from a partial goal summary", () => {
    const markdown = `# Feature Design

## Goal Summary
- **Objective:** Improve workflow clarity
- **Constraints:** Do not add a second state machine
- **Verification checks:** New tests pass
`;

    expect(parseGoalArtifact(markdown)).toEqual({
      missingSections: ["Why it matters", "Success signals", "Scope / Off-limits", "Stop conditions"],
      executionMode: null,
    });
  });

  test("treats non-goal markdown as incomplete instead of silently valid", () => {
    const markdown = `# Random Notes

This file has no goal summary at all.`;

    expect(parseGoalArtifact(markdown)).toEqual({
      missingSections: [...REQUIRED_GOAL_SECTIONS],
      executionMode: null,
    });
  });

  test("extracts standard execution mode", () => {
    const markdown = `# Plan

**Execution Mode:** standard

## Goal Summary
- **Objective:** Ship a normal feature
- **Why it matters:** Needed for user workflow
- **Constraints:** No API breakage
- **Success signals:** Feature works in the happy path
- **Verification checks:** Relevant tests pass
- **Scope / Off-limits:** Only feature files
- **Stop conditions:** Stop when implementation and verification are complete
`;

    expect(parseGoalArtifact(markdown).executionMode).toBe("standard");
  });
});
