import { describe, test, expect } from "vitest";
import workflowMonitorExtension from "../../../extensions/workflow-monitor";

type Handler = (event: any, ctx: any) => any;

function createFakePi() {
  const handlers = new Map<string, Handler[]>();
  return {
    handlers,
    api: {
      on(event: string, handler: Handler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerTool() {},
      registerCommand() {},
      appendEntry() {},
    },
  };
}

function getSingleHandler(handlers: Map<string, Handler[]>, event: string): Handler {
  const list = handlers.get(event) ?? [];
  expect(list.length).toBeGreaterThan(0);
  return list[0]!;
}

describe("practice escalation", () => {
  test("second TDD violation blocks the write (interactive)", async () => {
    const fake = createFakePi();
    workflowMonitorExtension(fake.api as any);

    const onToolCall = getSingleHandler(fake.handlers, "tool_call");

    let promptCount = 0;
    const ctx = {
      hasUI: true,
      sessionManager: { getBranch: () => [] },
      ui: {
        setWidget: () => {},
        select: async () => {
          promptCount += 1;
          return "No, stop";
        },
        setEditorText: () => {},
        notify: () => {},
      },
    };

    // 1st TDD violation: allowed (warn later in tool_result)
    await onToolCall({ toolCallId: "t1", toolName: "write", input: { path: "src/a.ts", content: "x" } }, ctx);

    // 2nd TDD violation: should block
    const res = await onToolCall({ toolCallId: "t2", toolName: "write", input: { path: "src/b.ts", content: "y" } }, ctx);

    expect(promptCount).toBe(1);
    expect(res).toEqual({ blocked: true });
  });
});
