import { describe, test, expect, vi } from "vitest";
import subagentExtension from "../../../extensions/subagent";

describe("subagent extension", () => {
  test("registers subagent tool", () => {
    const registerTool = vi.fn();
    subagentExtension({
      registerTool,
      on: vi.fn(),
      registerCommand: vi.fn(),
      appendEntry: vi.fn(),
    } as any);

    expect(registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subagent",
      })
    );
  });
});
