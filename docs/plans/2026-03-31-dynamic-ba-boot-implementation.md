# Dynamic BA Boot Extension — Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Implement the `orchestrator-boot` extension that transforms a local model into a Senior Business Analyst via dynamic system prompt injection, activated on-demand via `/ba` command or `--ba` CLI flag.

**Architecture:** Single extension file (`extensions/orchestrator-boot.ts`) with four components (Activator, Prompt Injector, Progress Tracker, Handoff Engine). Pure helper functions are extracted for testability. State persisted via `pi.appendEntry()`. Progress tracked via a running markdown file on disk.

**Tech Stack:** TypeScript, pi extension API (`@mariozechner/pi-coding-agent`), vitest for testing, node:fs / node:path for file operations.

**Execution Mode:** standard

## Goal Summary
- **Objective:** Build a BA persona extension that runs on a local model, saving premium API credits for ideation
- **Why it matters:** Eliminates premium credit consumption during requirements-gathering; credits spent only once for architect subagent
- **Constraints:** System prompt ≤800 tokens; no hardcoded examples; principle-based only; must handle tangents; must stop at DoR
- **Success signals:** `/ba` activates BA mode; TUI widget tracks 10 DoR dimensions; architect dispatched only when DoR met; state survives restart
- **Verification checks:** `vitest run` passes; `/ba` command works; `--ba` flag works; widget updates on edit; DoR enforcement blocks premature dispatch
- **Scope / Off-limits:** Only create `extensions/orchestrator-boot.ts` and `tests/extension/orchestrator-boot/` files. Do not modify any existing extensions.
- **Stop conditions:** All tests pass, extension loads without errors, registered in `package.json` pi.extensions

---

### Task 1: Create test helpers and scaffold

**TDD scenario:** New feature — set up test infrastructure first.

**Files:**
- Create: `tests/extension/orchestrator-boot/test-helpers.ts`
- Create: `tests/extension/orchestrator-boot/count-completed.test.ts` (empty placeholder)

**Step 1: Create test helpers**

Create `tests/extension/orchestrator-boot/test-helpers.ts` following the pattern from `tests/extension/workflow-monitor/test-helpers.ts`:

```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect } from "vitest";

type Handler = (event: any, ctx: any) => any;

const ORIGINAL_CWD = process.cwd();
const TEMP_DIRS: string[] = [];

export function withTempCwd(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ba-test-"));
  TEMP_DIRS.push(dir);
  process.chdir(dir);
  return dir;
}

afterEach(() => {
  if (process.cwd() !== ORIGINAL_CWD) {
    process.chdir(ORIGINAL_CWD);
  }
  for (const dir of TEMP_DIRS.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

export function createFakePi() {
  withTempCwd();

  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, { description: string; handler: Handler }>();
  const appendedEntries: Array<{ customType: string; data: any }> = [];
  const flags = new Map<string, { type: string; default?: any; value?: any }>();

  return {
    handlers,
    commands,
    appendedEntries,
    flags,
    api: {
      on(event: string, handler: Handler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerTool() {},
      registerCommand(name: string, opts: any) {
        commands.set(name, opts);
      },
      registerFlag(name: string, opts: any) {
        flags.set(name, opts);
      },
      getFlag(name: string) {
        const flag = flags.get(name);
        return flag?.value ?? flag?.default;
      },
      appendEntry(customType: string, data: any) {
        appendedEntries.push({ customType, data });
      },
      sendMessage() {},
    },
  };
}

export function getSingleHandler(handlers: Map<string, Handler[]>, event: string): Handler {
  const list = handlers.get(event) ?? [];
  expect(list.length).toBeGreaterThan(0);
  return list[0]!;
}

export function getHandlers(handlers: Map<string, Handler[]>, event: string): Handler[] {
  return handlers.get(event) ?? [];
}

export function createFakeCtx(overrides?: Partial<{ cwd: string; hasUI: boolean }>) {
  const cwd = overrides?.cwd ?? process.cwd();
  const widgets = new Map<string, any>();
  const notifications: Array<{ message: string; type: string }> = [];

  return {
    ctx: {
      cwd,
      hasUI: overrides?.hasUI ?? true,
      ui: {
        setWidget(key: string, content: any) {
          if (content === undefined) widgets.delete(key);
          else widgets.set(key, content);
        },
        notify(message: string, type: string = "info") {
          notifications.push({ message, type });
        },
      },
      sessionManager: {
        getEntries() {
          return [];
        },
      },
    },
    widgets,
    notifications,
  };
}
```

**Step 2: Commit**

```bash
git add tests/extension/orchestrator-boot/test-helpers.ts
git commit -m "test: add orchestrator-boot test helpers"
```

---

### Task 2: Implement and test `countCompleted()`

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/count-completed.test.ts`
- Create: `extensions/orchestrator-boot.ts` (export helpers only)

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/count-completed.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { countCompleted, NOT_COVERED, SECTION_LABELS } from "../../../extensions/orchestrator-boot";
import { withTempCwd } from "./test-helpers";

describe("countCompleted", () => {
  test("returns 0 completed for a fresh template", () => {
    const dir = withTempCwd();
    const filePath = path.join(dir, "requirements.md");
    const content = SECTION_LABELS.map((_, i) =>
      `## ${i + 1}. ${SECTION_LABELS[i]}\n${NOT_COVERED}`
    ).join("\n\n");
    fs.writeFileSync(filePath, content);

    const result = countCompleted(filePath);
    expect(result.completed).toEqual([]);
    expect(result.total).toBe(10);
  });

  test("detects a single completed section", () => {
    const dir = withTempCwd();
    const filePath = path.join(dir, "requirements.md");
    const sections = SECTION_LABELS.map((label, i) => {
      const sectionNum = i + 1;
      if (sectionNum === 1) {
        return `## ${sectionNum}. ${label}\nUsers need to swap books safely.`;
      }
      return `## ${sectionNum}. ${label}\n${NOT_COVERED}`;
    });
    fs.writeFileSync(filePath, sections.join("\n\n"));

    const result = countCompleted(filePath);
    expect(result.completed).toEqual(["Problem"]);
    expect(result.total).toBe(10);
  });

  test("detects multiple completed sections", () => {
    const dir = withTempCwd();
    const filePath = path.join(dir, "requirements.md");
    const sections = SECTION_LABELS.map((label, i) => {
      const sectionNum = i + 1;
      if (sectionNum <= 3) {
        return `## ${sectionNum}. ${label}\nSome real content here.`;
      }
      return `## ${sectionNum}. ${label}\n${NOT_COVERED}`;
    });
    fs.writeFileSync(filePath, sections.join("\n\n"));

    const result = countCompleted(filePath);
    expect(result.completed).toEqual(["Problem", "Users", "Alternatives"]);
  });

  test("detects all 10 completed", () => {
    const dir = withTempCwd();
    const filePath = path.join(dir, "requirements.md");
    const sections = SECTION_LABELS.map((label, i) =>
      `## ${i + 1}. ${label}\nContent for ${label}.`
    );
    fs.writeFileSync(filePath, sections.join("\n\n"));

    const result = countCompleted(filePath);
    expect(result.completed.length).toBe(10);
  });

  test("returns empty on file read error", () => {
    const result = countCompleted("/nonexistent/path/file.md");
    expect(result.completed).toEqual([]);
    expect(result.total).toBe(10);
  });

  test("handles multi-line section content correctly", () => {
    const dir = withTempCwd();
    const filePath = path.join(dir, "requirements.md");
    const sections = SECTION_LABELS.map((label, i) => {
      const sectionNum = i + 1;
      if (sectionNum === 1) {
        return `## ${sectionNum}. ${label}\nLine one.\nLine two.\nLine three.`;
      }
      return `## ${sectionNum}. ${label}\n${NOT_COVERED}`;
    });
    fs.writeFileSync(filePath, sections.join("\n\n"));

    const result = countCompleted(filePath);
    expect(result.completed).toEqual(["Problem"]);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/count-completed.test.ts
```
Expected: FAIL — `extensions/orchestrator-boot` module not found.

**Step 3: Write minimal implementation**

Create `extensions/orchestrator-boot.ts` with only the helper exports:

```typescript
// extensions/orchestrator-boot.ts
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export const SECTION_LABELS = [
  "Problem", "Users", "Alternatives", "Workflow", "Data",
  "Scope", "Safety", "Platform", "MVP", "Success",
];

export const NOT_COVERED = "_Not yet covered_";

export const BA_STATE_ENTRY_TYPE = "ba_mode";

export function countCompleted(filePath: string): { completed: string[]; total: number } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const completed = SECTION_LABELS.filter((_, i) => {
      const sectionNum = i + 1;
      const sectionHeader = `## ${sectionNum}.`;
      const headerIdx = content.indexOf(sectionHeader);
      if (headerIdx === -1) return false;
      const nextLineStart = content.indexOf("\n", headerIdx) + 1;
      if (nextLineStart === 0) return false; // no newline after header
      const nextLineEnd = content.indexOf("\n", nextLineStart);
      const nextLine = nextLineEnd === -1
        ? content.slice(nextLineStart)
        : content.slice(nextLineStart, nextLineEnd);
      return !nextLine.startsWith(NOT_COVERED);
    });
    return { completed, total: SECTION_LABELS.length };
  } catch {
    return { completed: [], total: SECTION_LABELS.length };
  }
}

// Stub default export to satisfy pi extension loader
export default function (pi: ExtensionAPI) {}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/count-completed.test.ts
```
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/count-completed.test.ts
git commit -m "feat: add countCompleted() with tests for orchestrator-boot"
```

---

### Task 3: Implement and test `createRunningFile()` and `isRunningFilePath()`

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/running-file.test.ts`
- Modify: `extensions/orchestrator-boot.ts`

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/running-file.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createRunningFile,
  isRunningFilePath,
  NOT_COVERED,
} from "../../../extensions/orchestrator-boot";
import { withTempCwd } from "./test-helpers";

describe("createRunningFile", () => {
  test("creates file at absolute path under cwd/docs/plans/", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");

    expect(path.isAbsolute(filePath)).toBe(true);
    expect(filePath).toBe(path.resolve(dir, "docs", "plans", "2026-03-31-requirements.md"));
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("creates parent directories if they don't exist", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");

    expect(fs.existsSync(path.dirname(filePath))).toBe(true);
  });

  test("file contains all 10 sections with NOT_COVERED placeholders", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    const content = fs.readFileSync(filePath, "utf-8");

    for (let i = 1; i <= 10; i++) {
      expect(content).toContain(`## ${i}.`);
    }
    expect(content.split(NOT_COVERED).length - 1).toBe(10);
  });

  test("file header contains TBD topic and date", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain("# Product Requirements: TBD");
    expect(content).toContain("**Date:** 2026-03-31");
  });

  test("throws on filesystem error", () => {
    expect(() => createRunningFile("/nonexistent/readonly", "2026-03-31")).toThrow();
  });
});

describe("isRunningFilePath", () => {
  test("matches identical absolute paths", () => {
    expect(isRunningFilePath("/a/b/c.md", "/a/b/c.md", "/a")).toBe(true);
  });

  test("matches relative event path against absolute running file path", () => {
    expect(isRunningFilePath(
      "docs/plans/2026-03-31-requirements.md",
      "/home/user/project/docs/plans/2026-03-31-requirements.md",
      "/home/user/project"
    )).toBe(true);
  });

  test("matches ./prefixed event path", () => {
    expect(isRunningFilePath(
      "./docs/plans/2026-03-31-requirements.md",
      "/home/user/project/docs/plans/2026-03-31-requirements.md",
      "/home/user/project"
    )).toBe(true);
  });

  test("does not match different files", () => {
    expect(isRunningFilePath(
      "docs/plans/other-file.md",
      "/home/user/project/docs/plans/2026-03-31-requirements.md",
      "/home/user/project"
    )).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/running-file.test.ts
```
Expected: FAIL — `createRunningFile` and `isRunningFilePath` not exported.

**Step 3: Add implementations to `extensions/orchestrator-boot.ts`**

Add these exports after the existing `countCompleted` function:

```typescript
export function createRunningFile(cwd: string, date: string): string {
  const filePath = path.resolve(cwd, "docs", "plans", `${date}-requirements.md`);
  const template = `# Product Requirements: TBD
**Status:** In Progress
**Date:** ${date}

## 1. Problem
${NOT_COVERED}

## 2. Target Users
${NOT_COVERED}

## 3. Existing Alternatives
${NOT_COVERED}

## 4. Core Workflow
${NOT_COVERED}

## 5. Data Entities
${NOT_COVERED}

## 6. Scope Boundaries
${NOT_COVERED}

## 7. Trust & Safety
${NOT_COVERED}

## 8. Platform & Constraints
${NOT_COVERED}

## 9. MVP Cut
${NOT_COVERED}

## 10. Success Criteria
${NOT_COVERED}
`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, template);
  } catch (err) {
    throw new Error(`Failed to create running file at ${filePath}: ${err}`);
  }
  return filePath;
}

export function isRunningFilePath(eventPath: string, runningFilePath: string, cwd: string): boolean {
  return path.resolve(cwd, eventPath) === path.resolve(cwd, runningFilePath);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/running-file.test.ts
```
Expected: All 9 tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/running-file.test.ts
git commit -m "feat: add createRunningFile() and isRunningFilePath() with tests"
```

---

### Task 4: Implement and test `renderWidget()`

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/widget.test.ts`
- Modify: `extensions/orchestrator-boot.ts`

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/widget.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import {
  renderWidget,
  createRunningFile,
  NOT_COVERED,
  SECTION_LABELS,
} from "../../../extensions/orchestrator-boot";
import { withTempCwd, createFakeCtx } from "./test-helpers";

describe("renderWidget", () => {
  test("shows 0/10 for fresh template", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    const { ctx, widgets } = createFakeCtx({ cwd: dir });

    renderWidget(ctx as any, filePath);

    const content = widgets.get("ba-progress") as string[];
    expect(content).toHaveLength(2);
    expect(content[0]).toContain("0/10");
    expect(content[0]).toContain("BA ");
    expect(content[1]).toContain("No dimensions covered yet");
  });

  test("shows progress for partially completed file", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    // Fill in section 1
    let content = fs.readFileSync(filePath, "utf-8");
    content = content.replace(
      `## 1. Problem\n${NOT_COVERED}`,
      "## 1. Problem\nUsers need to swap books safely."
    );
    fs.writeFileSync(filePath, content);

    const { ctx, widgets } = createFakeCtx({ cwd: dir });
    renderWidget(ctx as any, filePath);

    const widgetContent = widgets.get("ba-progress") as string[];
    expect(widgetContent[0]).toContain("1/10");
    expect(widgetContent[1]).toContain("Problem ✓");
  });

  test("shows 10/10 when all sections filled", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    let content = fs.readFileSync(filePath, "utf-8");
    SECTION_LABELS.forEach((label, i) => {
      content = content.replace(
        `## ${i + 1}. ${label}\n${NOT_COVERED}`,
        `## ${i + 1}. ${label}\nReal content for ${label}.`
      );
    });
    // Fix: section headers in file use full names, not short labels
    // The replace above uses SECTION_LABELS which are short names.
    // The actual file uses full names like "Target Users", "Existing Alternatives" etc.
    // We need to re-read and manually replace the NOT_COVERED markers.
    content = fs.readFileSync(filePath, "utf-8");
    content = content.replaceAll(NOT_COVERED, "Real content here.");
    fs.writeFileSync(filePath, content);

    const { ctx, widgets } = createFakeCtx({ cwd: dir });
    renderWidget(ctx as any, filePath);

    const widgetContent = widgets.get("ba-progress") as string[];
    expect(widgetContent[0]).toContain("10/10");
  });

  test("does nothing when ctx.hasUI is false", () => {
    const dir = withTempCwd();
    const filePath = createRunningFile(dir, "2026-03-31");
    const { ctx, widgets } = createFakeCtx({ cwd: dir, hasUI: false });

    renderWidget(ctx as any, filePath);

    expect(widgets.size).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/widget.test.ts
```
Expected: FAIL — `renderWidget` not exported.

**Step 3: Add `renderWidget` to `extensions/orchestrator-boot.ts`**

```typescript
export function renderWidget(ctx: ExtensionContext, filePath: string): void {
  if (!ctx.hasUI) return;
  const { completed, total } = countCompleted(filePath);
  const filled = Math.round((completed.length / total) * 20);
  const bar = "▓".repeat(filled) + "░".repeat(20 - filled);
  const line1 = `BA ${bar} ${completed.length}/${total}`;
  const line2 = completed.length > 0
    ? "   " + completed.map(s => `${s} ✓`).join("  ")
    : "   No dimensions covered yet";
  ctx.ui.setWidget("ba-progress", [line1, line2]);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/widget.test.ts
```
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/widget.test.ts
git commit -m "feat: add renderWidget() with TUI progress display and tests"
```

---

### Task 5: Implement and test the system prompt template

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/system-prompt.test.ts`
- Modify: `extensions/orchestrator-boot.ts`

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/system-prompt.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { BA_SYSTEM_PROMPT, buildSystemPrompt } from "../../../extensions/orchestrator-boot";

describe("BA_SYSTEM_PROMPT", () => {
  test("contains no hardcoded examples", () => {
    // Must not contain specific product names, app ideas, or example scenarios
    expect(BA_SYSTEM_PROMPT).not.toMatch(/e\.g\.\s*["'][A-Z]/);
    expect(BA_SYSTEM_PROMPT).not.toMatch(/for example.*app/i);
    expect(BA_SYSTEM_PROMPT).not.toMatch(/such as.*platform/i);
  });

  test("contains all 10 DoR dimensions", () => {
    expect(BA_SYSTEM_PROMPT).toContain("1. Problem");
    expect(BA_SYSTEM_PROMPT).toContain("2. Target Users");
    expect(BA_SYSTEM_PROMPT).toContain("3. Existing Alternatives");
    expect(BA_SYSTEM_PROMPT).toContain("4. Core Workflow");
    expect(BA_SYSTEM_PROMPT).toContain("5. Data Entities");
    expect(BA_SYSTEM_PROMPT).toContain("6. Scope Boundaries");
    expect(BA_SYSTEM_PROMPT).toContain("7. Trust & Safety");
    expect(BA_SYSTEM_PROMPT).toContain("8. Platform & Constraints");
    expect(BA_SYSTEM_PROMPT).toContain("9. MVP Cut");
    expect(BA_SYSTEM_PROMPT).toContain("10. Success Criteria");
  });

  test("contains the {running_file} placeholder", () => {
    expect(BA_SYSTEM_PROMPT).toContain("{running_file}");
  });

  test("instructs one question at a time", () => {
    expect(BA_SYSTEM_PROMPT).toMatch(/ONE question/i);
  });

  test("instructs to use exact path", () => {
    expect(BA_SYSTEM_PROMPT).toMatch(/exact path/i);
  });
});

describe("buildSystemPrompt", () => {
  test("replaces {running_file} with actual path", () => {
    const result = buildSystemPrompt("/home/user/docs/plans/2026-03-31-requirements.md");
    expect(result).not.toContain("{running_file}");
    expect(result).toContain("/home/user/docs/plans/2026-03-31-requirements.md");
  });

  test("preserves all other prompt content", () => {
    const result = buildSystemPrompt("/any/path.md");
    expect(result).toContain("Senior Business Analyst");
    expect(result).toContain("DEFINITION OF READY");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/system-prompt.test.ts
```
Expected: FAIL — `BA_SYSTEM_PROMPT` and `buildSystemPrompt` not exported.

**Step 3: Add the system prompt and builder to `extensions/orchestrator-boot.ts`**

```typescript
export const BA_SYSTEM_PROMPT = `You are a Senior Business Analyst and Product Manager.

YOUR ROLE:
- Help the user refine vague product ideas into clear, actionable Product Requirements.
- Use Socratic questioning: ask one focused question at a time.
- Never assume. Always ask.

CONVERSATION RULES:
- Ask exactly ONE question per response.
- When the user goes on a tangent, acknowledge it, capture any useful information from it, then steer back to the next uncovered dimension.
- After each answer, state which dimensions are still uncovered.
- Keep responses concise. Under 150 words per response.

DEFINITION OF READY — 10 DIMENSIONS:
You must gather clear answers for ALL of these before proposing final requirements:
1. Problem — What pain or need exists?
2. Target Users — Who experiences this pain?
3. Existing Alternatives — What solutions exist? Why are they insufficient?
4. Core Workflow — The primary user journey (happy path)
5. Data Entities — What key objects/data does the system manage?
6. Scope Boundaries — What is explicitly NOT included?
7. Trust & Safety — Security, privacy, moderation needs
8. Platform & Constraints — Technology, budget, timeline, hardware limits
9. MVP Cut — The smallest viable first version
10. Success Criteria — How do we measure "it worked"?

RUNNING FILE:
- Your running file is at: {running_file}
- Use this exact path string when calling the edit or read tools. Do not guess, derive, or alter this path.
- After each answered dimension, use the edit tool to update the relevant section in this file.
- This file is your memory. If you need to recall what has been covered, read it.

WHEN DEFINITION OF READY IS MET:
1. Read the running file to compile the full spec.
2. Present the complete Product Requirements to the user for approval.
3. On approval, state: "REQUIREMENTS APPROVED. Dispatching architect for validation and technical design."
4. Use the subagent tool to dispatch the architect. The extension will automatically inject the compiled spec.

DO NOT:
- Provide hardcoded examples or sample products.
- Answer your own questions.
- Skip dimensions or declare DoR met prematurely.
- Ask more than one question per response.`;

export function buildSystemPrompt(runningFilePath: string): string {
  return BA_SYSTEM_PROMPT.replace("{running_file}", runningFilePath);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/system-prompt.test.ts
```
Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/system-prompt.test.ts
git commit -m "feat: add BA system prompt template with builder and tests"
```

---

### Task 6: Implement and test the extension wiring (activation, events, state persistence)

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/extension-wiring.test.ts`
- Modify: `extensions/orchestrator-boot.ts` — flesh out the `default export` function

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/extension-wiring.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import extensionFactory, { BA_STATE_ENTRY_TYPE } from "../../../extensions/orchestrator-boot";
import { createFakePi, createFakeCtx, getSingleHandler, getHandlers } from "./test-helpers";

describe("extension registration", () => {
  test("registers --ba flag", () => {
    const { api, flags } = createFakePi();
    extensionFactory(api as any);
    expect(flags.has("ba")).toBe(true);
    expect(flags.get("ba")!.type).toBe("boolean");
  });

  test("registers /ba command", () => {
    const { api, commands } = createFakePi();
    extensionFactory(api as any);
    expect(commands.has("ba")).toBe(true);
  });

  test("registers before_agent_start handler", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    expect(handlers.has("before_agent_start")).toBe(true);
  });

  test("registers tool_result handler", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    expect(handlers.has("tool_result")).toBe(true);
  });

  test("registers tool_call handler", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    expect(handlers.has("tool_call")).toBe(true);
  });

  test("registers session_start handler", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    expect(handlers.has("session_start")).toBe(true);
  });

  test("registers session_switch handler", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    expect(handlers.has("session_switch")).toBe(true);
  });
});

describe("/ba command handler", () => {
  test("activates BA mode and creates running file", async () => {
    const { api, commands, appendedEntries } = createFakePi();
    extensionFactory(api as any);
    const { ctx } = createFakeCtx();

    await commands.get("ba")!.handler("", ctx as any);

    // Should have persisted state
    expect(appendedEntries.length).toBe(1);
    expect(appendedEntries[0].customType).toBe(BA_STATE_ENTRY_TYPE);
    expect(appendedEntries[0].data.baMode).toBe(true);
    expect(fs.existsSync(appendedEntries[0].data.runningFilePath)).toBe(true);
  });

  test("warns if BA mode already active", async () => {
    const { api, commands } = createFakePi();
    extensionFactory(api as any);
    const { ctx, notifications } = createFakeCtx();

    await commands.get("ba")!.handler("", ctx as any);
    await commands.get("ba")!.handler("", ctx as any);

    expect(notifications.some(n => n.type === "warning" && n.message.includes("already active"))).toBe(true);
  });
});

describe("before_agent_start handler", () => {
  test("returns undefined when BA mode inactive", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    const { ctx } = createFakeCtx();
    const handler = getSingleHandler(handlers, "before_agent_start");

    const result = handler({ type: "before_agent_start", prompt: "hello", systemPrompt: "default" }, ctx);
    expect(result).toBeUndefined();
  });

  test("returns system prompt when BA mode active", async () => {
    const { api, handlers, commands } = createFakePi();
    extensionFactory(api as any);
    const { ctx } = createFakeCtx();

    // Activate BA mode
    await commands.get("ba")!.handler("", ctx as any);

    const handler = getSingleHandler(handlers, "before_agent_start");
    const result = handler({ type: "before_agent_start", prompt: "hello", systemPrompt: "default" }, ctx);

    expect(result).toBeDefined();
    expect(result.systemPrompt).toContain("Senior Business Analyst");
    expect(result.systemPrompt).not.toContain("{running_file}");
  });
});

describe("session_switch handler", () => {
  test("resets BA mode on session switch", async () => {
    const { api, handlers, commands } = createFakePi();
    extensionFactory(api as any);
    const { ctx, widgets } = createFakeCtx();

    // Activate BA mode
    await commands.get("ba")!.handler("", ctx as any);

    // Switch session
    const switchHandler = getSingleHandler(handlers, "session_switch");
    switchHandler({ type: "session_switch", reason: "new" }, ctx);

    // before_agent_start should now return undefined
    const agentHandler = getSingleHandler(handlers, "before_agent_start");
    const result = agentHandler({ type: "before_agent_start", prompt: "hi", systemPrompt: "default" }, ctx);
    expect(result).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/extension-wiring.test.ts
```
Expected: FAIL — stub default export doesn't register anything.

**Step 3: Replace the stub default export in `extensions/orchestrator-boot.ts`**

Replace the stub `export default function (pi: ExtensionAPI) {}` with the full implementation. Refer to the design doc's "Extension Implementation Outline" section for the complete code. Key points:

- Internal state: `let baMode = false; let runningFilePath: string | null = null;`
- `pi.registerFlag("ba", ...)` and `pi.registerCommand("ba", ...)`
- `pi.on("session_start", ...)` — reconstruct from entries, or activate from `--ba` flag
- `pi.on("session_switch", ...)` — reset state
- `pi.on("before_agent_start", ...)` — inject prompt via `buildSystemPrompt()`
- `pi.on("tool_result", ...)` — update widget via `isEditToolResult()` + `isRunningFilePath()`
- `pi.on("tool_call", ...)` — DoR enforcement + spec injection (Task 7)

For this task, implement everything **except** the `tool_call` handler (that's Task 7). Add a placeholder:

```typescript
pi.on("tool_call", (event, ctx) => {
  // Handoff engine — implemented in Task 7
});
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/extension-wiring.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/extension-wiring.test.ts
git commit -m "feat: wire orchestrator-boot extension with activation, prompt injection, state persistence"
```

---

### Task 7: Implement and test the Handoff Engine (DoR enforcement + spec injection)

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `tests/extension/orchestrator-boot/handoff-engine.test.ts`
- Modify: `extensions/orchestrator-boot.ts` — flesh out the `tool_call` handler

**Step 1: Write the failing tests**

Create `tests/extension/orchestrator-boot/handoff-engine.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import extensionFactory, { NOT_COVERED, SECTION_LABELS } from "../../../extensions/orchestrator-boot";
import { createFakePi, createFakeCtx, getSingleHandler, getHandlers } from "./test-helpers";

describe("handoff engine (tool_call interception)", () => {
  async function activateAndGetHandlers() {
    const { api, handlers, commands, appendedEntries } = createFakePi();
    extensionFactory(api as any);
    const { ctx } = createFakeCtx();
    await commands.get("ba")!.handler("", ctx as any);
    const runningFilePath = appendedEntries[0].data.runningFilePath;
    return { handlers, ctx, runningFilePath };
  }

  test("ignores non-subagent tool calls", async () => {
    const { handlers, ctx } = await activateAndGetHandlers();
    const handler = getSingleHandler(handlers, "tool_call");

    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "edit",
      input: { path: "foo.ts" },
    }, ctx);

    expect(result).toBeUndefined();
  });

  test("ignores subagent calls to non-architect agents", async () => {
    const { handlers, ctx } = await activateAndGetHandlers();
    const handler = getSingleHandler(handlers, "tool_call");

    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "subagent",
      input: { agent: "worker", task: "do stuff" },
    }, ctx);

    expect(result).toBeUndefined();
  });

  test("blocks architect dispatch when DoR not met", async () => {
    const { handlers, ctx } = await activateAndGetHandlers();
    const handler = getSingleHandler(handlers, "tool_call");

    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "subagent",
      input: { agent: "architect", task: "design something" },
    }, ctx);

    expect(result).toBeDefined();
    expect(result.block).toBe(true);
    expect(result.reason).toContain("DoR not met");
    expect(result.reason).toContain("0/10");
  });

  test("allows architect dispatch and injects spec when DoR fully met", async () => {
    const { handlers, ctx, runningFilePath } = await activateAndGetHandlers();

    // Fill all 10 sections
    let content = fs.readFileSync(runningFilePath, "utf-8");
    content = content.replaceAll(NOT_COVERED, "Real content here.");
    fs.writeFileSync(runningFilePath, content);

    const handler = getSingleHandler(handlers, "tool_call");
    const input = { agent: "architect", task: "design something" };
    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "subagent",
      input,
    }, ctx);

    // Should not block
    expect(result?.block).not.toBe(true);
    // Should have injected the spec into the task
    expect(input.task).toContain("Review this Product Requirements spec");
    expect(input.task).toContain("Real content here.");
  });

  test("blocks with missing dimensions listed in reason", async () => {
    const { handlers, ctx, runningFilePath } = await activateAndGetHandlers();

    // Fill only first 3 sections
    let content = fs.readFileSync(runningFilePath, "utf-8");
    for (let i = 1; i <= 3; i++) {
      const marker = new RegExp(`(## ${i}\\.[^\n]*\n)${NOT_COVERED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      content = content.replace(marker, `$1Content for section ${i}.`);
    }
    fs.writeFileSync(runningFilePath, content);

    const handler = getSingleHandler(handlers, "tool_call");
    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "subagent",
      input: { agent: "architect", task: "design" },
    }, ctx);

    expect(result.block).toBe(true);
    expect(result.reason).toContain("3/10");
    expect(result.reason).toContain("Workflow");
    expect(result.reason).toContain("Safety");
  });

  test("does nothing when BA mode is not active", () => {
    const { api, handlers } = createFakePi();
    extensionFactory(api as any);
    const { ctx } = createFakeCtx();
    const handler = getSingleHandler(handlers, "tool_call");

    const result = handler({
      type: "tool_call",
      toolCallId: "123",
      toolName: "subagent",
      input: { agent: "architect", task: "design" },
    }, ctx);

    expect(result).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extension/orchestrator-boot/handoff-engine.test.ts
```
Expected: FAIL — `tool_call` handler is a placeholder.

**Step 3: Implement the `tool_call` handler in `extensions/orchestrator-boot.ts`**

Replace the placeholder `pi.on("tool_call", ...)` with:

```typescript
  pi.on("tool_call", (event, ctx) => {
    if (!baMode || !runningFilePath) return;
    if (event.toolName !== "subagent") return;

    const input = event.input as Record<string, unknown>;
    const agent = input.agent as string | undefined;
    if (agent !== "architect" && agent !== "implementer") return;

    const { completed, total } = countCompleted(runningFilePath);
    if (completed.length < total) {
      const missing = SECTION_LABELS.filter(s => !completed.includes(s));
      return {
        block: true,
        reason: `DoR not met: ${completed.length}/${total} dimensions covered. ` +
          `Missing: ${missing.join(", ")}. ` +
          `Continue the conversation to cover remaining dimensions before dispatching.`,
      };
    }

    try {
      const spec = fs.readFileSync(runningFilePath, "utf-8");
      const reviewInstruction =
        "Review this Product Requirements spec for coherence, completeness, and viability. " +
        "If issues are found, list them. If sound, proceed to produce a full technical architecture design.";
      (input as any).task = `${reviewInstruction}\n\n---\n\n${spec}`;
    } catch (err) {
      return {
        block: true,
        reason: `Failed to read running file for spec injection: ${err}`,
      };
    }
  });
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extension/orchestrator-boot/handoff-engine.test.ts
```
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/handoff-engine.test.ts
git commit -m "feat: add handoff engine with DoR enforcement and spec injection"
```

---

### Task 8: Register extension in package.json and run full test suite

**TDD scenario:** Trivial change — verify everything integrates.

**Files:**
- Modify: `package.json` — add extension to `pi.extensions` array

**Step 1: Add extension to package.json**

Add `"extensions/orchestrator-boot.ts"` to the `pi.extensions` array in `package.json`:

```json
  "pi": {
    "extensions": [
      "extensions/plan-tracker.ts",
      "extensions/workflow-monitor.ts",
      "extensions/subagent/index.ts",
      "extensions/orchestrator-boot.ts"
    ],
```

**Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: ALL tests pass (existing + new orchestrator-boot tests).

**Step 3: Run lint**

```bash
npx biome check extensions/orchestrator-boot.ts tests/extension/orchestrator-boot/
```
Expected: No errors. Fix any formatting/lint issues.

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: register orchestrator-boot extension in package.json"
```

---

## Task Summary

| Task | Description | Test File | Est. |
|------|-------------|-----------|------|
| 1 | Test helpers & scaffold | `test-helpers.ts` | 3 min |
| 2 | `countCompleted()` | `count-completed.test.ts` | 5 min |
| 3 | `createRunningFile()` + `isRunningFilePath()` | `running-file.test.ts` | 5 min |
| 4 | `renderWidget()` | `widget.test.ts` | 5 min |
| 5 | System prompt template | `system-prompt.test.ts` | 5 min |
| 6 | Extension wiring (activation, events, state) | `extension-wiring.test.ts` | 10 min |
| 7 | Handoff engine (DoR + spec injection) | `handoff-engine.test.ts` | 10 min |
| 8 | Register in package.json + full suite | — | 3 min |

**Total: ~46 minutes estimated**
