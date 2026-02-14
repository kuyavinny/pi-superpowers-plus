import { describe, expect, test } from "vitest";
import workflowMonitorExtension from "../../../extensions/workflow-monitor";
import { createFakePi, getSingleHandler } from "./test-helpers";

describe("workflow monitor widget", () => {
  test("shows workflow phase strip when a workflow phase is active", async () => {
    const fake = createFakePi();
    workflowMonitorExtension(fake.api as any);

    let renderer: any;
    const ctx = {
      hasUI: true,
      sessionManager: { getBranch: () => [] },
      ui: {
        setWidget: (_id: string, widget: any) => {
          renderer = widget;
        },
        select: async () => "Skip brainstorm",
        setEditorText: () => {},
      },
    };

    const onInput = getSingleHandler(fake.handlers, "input");
    await onInput({ source: "user", text: "/skill:writing-plans" }, ctx);

    expect(renderer).toBeTypeOf("function");

    const theme = {
      fg: (_color: string, text: string) => text,
      bold: (text: string) => text,
    };

    const textNode = renderer(null, theme);
    expect(textNode.text).toContain("[plan]");
  });
});
