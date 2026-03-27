import { describe, expect, test } from "vitest";
import workflowMonitorExtension from "../../../extensions/workflow-monitor";
import { WORKFLOW_TRACKER_ENTRY_TYPE } from "../../../extensions/workflow-monitor/workflow-tracker";
import { createFakePi, getSingleHandler } from "./test-helpers";

describe("goal-aware boundary warnings", () => {
  test("writing a plain plan file missing goal sections injects a warning", async () => {
    const fake = createFakePi();
    workflowMonitorExtension(fake.api as any);

    const onSessionSwitch = getSingleHandler(fake.handlers, "session_switch");
    const onToolCall = getSingleHandler(fake.handlers, "tool_call");
    const onToolResult = getSingleHandler(fake.handlers, "tool_result");

    const ctx = {
      hasUI: false,
      sessionManager: {
        getBranch: () => [
          {
            type: "custom",
            customType: WORKFLOW_TRACKER_ENTRY_TYPE,
            data: {
              phases: {
                brainstorm: "complete",
                plan: "active",
                execute: "pending",
                verify: "pending",
                review: "pending",
                finish: "pending",
              },
              currentPhase: "plan",
              artifacts: { brainstorm: null, plan: null, execute: null, verify: null, review: null, finish: null },
              prompted: { brainstorm: false, plan: false, execute: false, verify: false, review: false, finish: false },
            },
          },
        ],
      },
      ui: { setWidget: () => {} },
    };

    await onSessionSwitch({}, ctx);

    const content = `# Feature Plan\n\n**Execution Mode:** standard\n\n## Goal Summary\n- **Objective:** Do the thing\n- **Constraints:** Stay safe\n`;

    await onToolCall(
      {
        toolCallId: "g1",
        toolName: "write",
        input: { path: "docs/plans/2026-03-27-sample.md", content },
      },
      ctx,
    );

    const res = await onToolResult(
      {
        toolCallId: "g1",
        toolName: "write",
        input: { path: "docs/plans/2026-03-27-sample.md", content },
        content: [{ type: "text", text: "ok" }],
        details: {},
      },
      ctx,
    );

    const text = (res?.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    expect(text).toContain("⚠️ GOAL GAPS");
    expect(text).toContain("Why it matters");
    expect(text).toContain("Success signals");
  });
});
