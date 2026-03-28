import { describe, expect, test, vi } from "vitest";
import subagentExtension from "../../../extensions/subagent";
import { decideTaskGrade, resolveTaskGrade, suggestTaskGrade } from "../../../extensions/subagent/task-grading";

describe("task grading", () => {
  test("suggests light for small narrow tasks", () => {
    expect(suggestTaskGrade({ task: "Review single file src/foo.ts for a minor naming issue" })).toBe("light");
  });

  test("suggests standard for typical implementation tasks", () => {
    expect(suggestTaskGrade({ task: "Implement auth retry handling in src/auth.ts with matching tests" })).toBe(
      "standard",
    );
  });

  test("suggests heavy for multi-file tasks", () => {
    expect(
      suggestTaskGrade({
        task: "Implement a change across src/auth.ts src/session.ts tests/auth.test.ts and tests/session.test.ts",
      }),
    ).toBe("heavy");
  });

  test("suggests deep for architecture-sensitive work", () => {
    expect(
      suggestTaskGrade({
        task: "Do a system-wide architecture review for a cross-cutting full feature change with broad context",
      }),
    ).toBe("deep");
  });

  test("final grade prefers explicit override when present", () => {
    expect(resolveTaskGrade("light", "deep")).toBe("deep");
    expect(decideTaskGrade({ task: "Review single file src/foo.ts" }, "heavy")).toEqual({
      suggestedGrade: "light",
      finalGrade: "heavy",
    });
  });

  test("grading is deterministic for the same task text", () => {
    const task = "Implement auth retry handling in src/auth.ts with matching tests";
    expect(decideTaskGrade({ task })).toEqual(decideTaskGrade({ task }));
  });
});

describe("subagent schema", () => {
  test("accepts grade and model override fields for single, parallel, and chain modes", () => {
    const registerTool = vi.fn();
    subagentExtension({
      registerTool,
      on: vi.fn(),
      registerCommand: vi.fn(),
      appendEntry: vi.fn(),
    } as never);

    const tool = registerTool.mock.calls[0][0];
    const properties = tool.parameters.properties as Record<string, { description?: string }>;

    expect(properties.grade?.description).toContain("Task grade override");
    expect(properties.model?.description).toContain("Model override");
    expect(properties.tasks).toBeDefined();
    expect(properties.chain).toBeDefined();
    expect(tool.parameters.properties.tasks.items.properties.grade?.description).toContain("Task grade override");
    expect(tool.parameters.properties.tasks.items.properties.model?.description).toContain("Model override");
    expect(tool.parameters.properties.chain.items.properties.grade?.description).toContain("Task grade override");
    expect(tool.parameters.properties.chain.items.properties.model?.description).toContain("Model override");
  });
});
