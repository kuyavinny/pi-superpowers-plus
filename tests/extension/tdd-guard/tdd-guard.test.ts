import { describe, expect, test } from "vitest";
import tddGuardExtension from "../../../extensions/tdd-guard";

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

describe("tdd-guard", () => {
  test("blocks write to src before any test run", async () => {
    const fake = createFakePi();
    tddGuardExtension(fake.api as any);

    const onToolCall = getSingleHandler(fake.handlers, "tool_call");

    const res = await onToolCall(
      { toolCallId: "w1", toolName: "write", input: { path: "src/x.ts", content: "export const x = 1" } },
      { hasUI: false },
    );

    expect(res).toEqual({ blocked: true });
  });

  test("failing test command does not unlock production writes", async () => {
    const fake = createFakePi();
    tddGuardExtension(fake.api as any);

    const onToolCall = getSingleHandler(fake.handlers, "tool_call");
    const onToolResult = getSingleHandler(fake.handlers, "tool_result");

    await onToolCall({ toolCallId: "t1", toolName: "bash", input: { command: "npm test" } }, { hasUI: false });
    await onToolResult(
      { toolCallId: "t1", toolName: "bash", input: { command: "npm test" }, details: { exitCode: 1 } },
      { hasUI: false },
    );

    const res = await onToolCall(
      { toolCallId: "w1", toolName: "write", input: { path: "src/x.ts", content: "export const x = 1" } },
      { hasUI: false },
    );

    expect(res).toEqual({ blocked: true });
  });

  test("passing test command unlocks production writes", async () => {
    const fake = createFakePi();
    tddGuardExtension(fake.api as any);

    const onToolCall = getSingleHandler(fake.handlers, "tool_call");
    const onToolResult = getSingleHandler(fake.handlers, "tool_result");

    await onToolCall({ toolCallId: "t1", toolName: "bash", input: { command: "npm test" } }, { hasUI: false });
    await onToolResult(
      { toolCallId: "t1", toolName: "bash", input: { command: "npm test" }, details: { exitCode: 0 } },
      { hasUI: false },
    );

    const res = await onToolCall(
      { toolCallId: "w1", toolName: "write", input: { path: "src/x.ts", content: "export const x = 1" } },
      { hasUI: false },
    );

    expect(res).toBeUndefined();
  });
});
