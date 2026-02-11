import { describe, test, expect } from "vitest";
import {
  WorkflowTracker,
  computeBoundaryToPrompt,
} from "../../../extensions/workflow-monitor/workflow-tracker";

describe("boundary prompting", () => {
  test("prompts after brainstorm complete", () => {
    const t = new WorkflowTracker();
    t.advanceTo("brainstorm");
    t.completeCurrent();
    const boundary = computeBoundaryToPrompt(t.getState());
    expect(boundary).toBe("design_committed");
  });
});
