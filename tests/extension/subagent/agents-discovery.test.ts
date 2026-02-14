import { describe, expect, test } from "vitest";
import { discoverAgents } from "../../../extensions/subagent/agents";

describe("subagent agent discovery", () => {
  test("discovers bundled agents from package agents/ directory", () => {
    const res = discoverAgents(process.cwd(), "project");
    const names = res.agents.map((a) => a.name);
    expect(names).toContain("implementer");
    expect(names).toContain("code-reviewer");
  });
});
