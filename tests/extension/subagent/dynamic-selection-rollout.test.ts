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

describe("dynamic selection rollout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockImplementation(() => createFakeProcess());
  });

  afterEach(() => {
    delete process.env.PI_SUBAGENT_DYNAMIC_MODEL_SELECTION;
  });

  test("dynamic selection disabled preserves static model behavior", async () => {
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

    const tool = registerTool();
    const result = await tool.execute(
      "id",
      { agent: "implementer", task: "Implement auth retry handling in src/auth.ts with matching tests", grade: "standard" },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(spawnMock.mock.calls[0][1]).toContain("openai-codex/static-model");
    expect(result.details.selection).toEqual({
      agentType: "implementer",
      suggestedGrade: "standard",
      finalGrade: "standard",
      selectedModel: "openai-codex/static-model",
      overrideUsed: false,
      fallbackReason: undefined,
      selectionReason: "static agent model",
    });
  });

  test("single-mode dynamic selection uses the policy-selected model when enabled", async () => {
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

    const tool = registerTool();
    const result = await tool.execute(
      "id",
      { agent: "implementer", task: "Implement auth retry handling in src/auth.ts with matching tests", grade: "standard" },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(spawnMock.mock.calls[0][1]).toContain("openai-codex/gpt-5-mini");
    expect(result.details.selection.selectedModel).toBe("openai-codex/gpt-5-mini");
    expect(result.details.selection.selectionReason).toBe("lowest-cost eligible available model");
  });

  test("bare explicit model overrides are provider-qualified before spawning the subagent", async () => {
    discoverAgentsMock.mockReturnValue({
      agents: [
        {
          name: "worker",
          source: "project",
          filePath: "/tmp/worker.md",
          systemPrompt: "",
        },
      ],
      projectAgentsDir: null,
    });

    const tool = registerTool();
    const result = await tool.execute(
      "id",
      { agent: "worker", task: "Reply with OK", model: "gemini-2.5-flash" },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(spawnMock.mock.calls[0][1]).toContain("google-gemini-cli/gemini-2.5-flash");
    expect(result.details.selection.selectedModel).toBe("google-gemini-cli/gemini-2.5-flash");
    expect(result.details.selection.overrideUsed).toBe(true);
  });

  test("parallel and chain modes remain on static model during guarded rollout", async () => {
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

    const tool = registerTool();
    await tool.execute(
      "id",
      { tasks: [{ agent: "implementer", task: "Implement auth retry handling in src/auth.ts", grade: "standard" }] },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );
    await tool.execute(
      "id",
      { chain: [{ agent: "implementer", task: "Implement auth retry handling in src/auth.ts", grade: "standard" }] },
      undefined,
      undefined,
      { cwd: process.cwd(), hasUI: false },
    );

    expect(spawnMock.mock.calls[0][1]).toContain("openai-codex/static-model");
    expect(spawnMock.mock.calls[1][1]).toContain("openai-codex/static-model");
  });
});
