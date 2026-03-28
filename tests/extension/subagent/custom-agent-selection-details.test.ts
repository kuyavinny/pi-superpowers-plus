import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

function createFakeProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => true);
  queueMicrotask(() => proc.emit("exit", 0));
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

describe("custom agent selection details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockImplementation(() => createFakeProcess());
    discoverAgentsMock.mockReturnValue({
      agents: [{ name: "custom-helper", source: "project", filePath: "/tmp/custom-helper.md", systemPrompt: "", model: "custom-model" }],
      projectAgentsDir: null,
    });
  });

  test("selection metadata preserves custom agent name instead of relabeling as worker", async () => {
    const tool = registerTool();
    const result = await tool.execute(
      "id",
      { agent: "custom-helper", task: "Review a single file" },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(result.details.selection.agentType).toBe("custom-helper");
    expect(result.details.selection.selectionReason).toBe("static agent model");
  });
});
