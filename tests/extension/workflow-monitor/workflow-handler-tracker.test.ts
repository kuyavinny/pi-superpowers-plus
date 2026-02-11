import { describe, test, expect, beforeEach } from "vitest";
import {
  createWorkflowHandler,
  type WorkflowHandler,
} from "../../../extensions/workflow-monitor/workflow-handler";

describe("WorkflowHandler workflow-tracker integration", () => {
  let handler: WorkflowHandler;

  beforeEach(() => {
    handler = createWorkflowHandler();
  });

  test("input /skill:writing-plans activates plan phase", () => {
    handler.handleInputText("/skill:writing-plans");
    expect(handler.getWorkflowState()!.currentPhase).toBe("plan");
  });
});
