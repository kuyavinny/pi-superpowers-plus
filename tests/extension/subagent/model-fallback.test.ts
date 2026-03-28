import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { spawnMock, discoverAgentsMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  discoverAgentsMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("../../../extensions/subagent/agents.js", () => ({
  discoverAgents: discoverAgentsMock,
}));

import subagentExtension from "../../../extensions/subagent/index";

type Handler = (event: unknown, ctx: unknown) => unknown;

function createFakeProcess(exitCode: number, stderrText = "") {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => true);
  queueMicrotask(() => {
    if (stderrText) proc.stderr.emit("data", Buffer.from(stderrText));
    proc.emit("exit", exitCode);
  });
  return proc;
}

function registerTool() {
  let tool: any;
  subagentExtension({
    registerTool: (t: unknown) => {
      tool = t;
    },
    on: vi.fn() as unknown as Handler,
    registerCommand: vi.fn(),
    appendEntry: vi.fn(),
  } as never);
  return tool;
}

describe("dynamic model fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PI_SUBAGENT_DYNAMIC_MODEL_SELECTION = "1";
    discoverAgentsMock.mockReturnValue({
      agents: [
        {
          name: "implementer",
          source: "project",
          filePath: "/tmp/implementer.md",
          systemPrompt: "",
          model: "openai-codex/static-model",
        },
      ],
      projectAgentsDir: null,
    });
  });

  afterEach(() => {
    delete process.env.PI_SUBAGENT_DYNAMIC_MODEL_SELECTION;
  });

  test("falls back to the next eligible model when the selected model is reported unavailable", async () => {
    spawnMock
      .mockImplementationOnce(() => createFakeProcess(1, "Model openai-codex/gpt-5-mini not found"))
      .mockImplementationOnce(() => createFakeProcess(0));

    const tool = registerTool();
    const result = await tool.execute(
      "id",
      { agent: "implementer", task: "Implement auth retry handling in src/auth.ts with matching tests", grade: "standard" },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock.mock.calls[0][1]).toContain("openai-codex/gpt-5-mini");
    expect(spawnMock.mock.calls[1][1]).toContain("anthropic/claude-sonnet-4-5");
    expect(result.details.selection.selectedModel).toBe("anthropic/claude-sonnet-4-5");
    expect(result.details.selection.fallbackReason).toBe("openai-codex/gpt-5-mini unavailable");
  });
});
