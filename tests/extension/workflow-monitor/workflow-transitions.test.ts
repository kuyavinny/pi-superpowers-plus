import { describe, expect, test } from "vitest";
import { getTransitionPrompt } from "../../../extensions/workflow-monitor/workflow-transitions";

describe("workflow transitions", () => {
  test("design-committed prompt targets plan", () => {
    const p = getTransitionPrompt("design_committed", "docs/plans/x-design.md");
    expect(p.title).toMatch(/Design committed/i);
    expect(p.nextPhase).toBe("plan");
    expect(p.options).toHaveLength(4);
  });

  test("plan-ready prompt mentions autoresearch when execution mode is autoresearch", () => {
    const p = getTransitionPrompt("plan_ready", "docs/plans/x-implementation.md", { executionMode: "autoresearch" });
    expect(p.title).toMatch(/autoresearch/i);
    expect(p.nextPhase).toBe("execute");
  });
});
