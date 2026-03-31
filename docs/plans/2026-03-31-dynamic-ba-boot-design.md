# Dynamic BA Boot Extension Design

**Date:** 2026-03-31
**Status:** Ready for Implementation

## Goal

### Objective
Build an `orchestrator-boot` extension for pi-superpowers-plus that transforms a local 14B model into a Senior Business Analyst via a dynamic system prompt, activated on-demand via `/ba` command or `--ba` CLI flag.

### Why it matters
Eliminates premium API credit consumption for the ideation and requirements-gathering phase. The local model handles all conversational BA work for free; premium credits are spent once — when the architect subagent validates and designs.

### Constraints
- System prompt ≤800 tokens (14B model on 20GB VRAM, 8-16k context window)
- No hardcoded examples in the prompt (prevents semantic anchoring, saves tokens)
- Principle-based, top-down instructions only
- Must handle user tangents without losing progress
- Must stop asking questions when Definition of Ready is met

### Success signals
- Vague idea → structured Product Requirements spec through natural conversation
- No infinite question loops
- Premium model called exactly once (architect)
- 14B responses fast enough to maintain conversational flow

### Verification checks
- `/ba` activates BA mode and injects system prompt
- `--ba` flag activates BA mode on session start
- Running file is created on activation with 10 empty sections
- TUI widget displays and updates as sections are filled
- BA asks one question at a time
- BA handles tangents (absorb, capture, steer back)
- BA updates running file via edit tool after each answered dimension
- BA presents compiled spec when DoR 10/10 is met
- Architect subagent is dispatched on user approval with validation + design task

### Scope / Off-limits
- Model selection (separate concern)
- Ollama infrastructure (already designed in local-orchestrator-setup.md)
- Modifying existing extensions

### Execution mode hint
Single extension file with four internal components.

### Stop conditions
Extension activates, injects BA prompt, tracks DoR, writes running file, dispatches architect on approval.

---

## Architecture Overview

The extension has four components:

```
┌─────────────────────────────────────────────────────┐
│                orchestrator-boot.ts                  │
├─────────────────────────────────────────────────────┤
│  1. Activator         - /ba command + --ba flag     │
│  2. Prompt Injector   - before_agent_start hook     │
│  3. Progress Tracker  - TUI widget + file watcher   │
│  4. Handoff Engine    - compiles spec, dispatches   │
│                         architect subagent           │
└─────────────────────────────────────────────────────┘
```

**Activator:** Registers `/ba` command and `--ba` CLI flag. When triggered, sets an internal `baMode = true` flag. This flag gates all other components — when `false`, the extension is inert.

**Prompt Injector:** Hooks `before_agent_start`. When `baMode` is true, returns a `BeforeAgentStartEventResult` with the BA system prompt. This *replaces* the default coding-assistant prompt for the session.

**Progress Tracker:** A two-line TUI widget (via `ctx.ui.setWidget()`) showing a progress bar and completed dimensions. Updated by parsing the running file on disk when edit tool calls target it.

**Handoff Engine:** When the BA declares DoR met and the user approves, the BA (instructed by the system prompt) dispatches the `architect` subagent with the compiled spec and validation + design instructions.

---

## The System Prompt

~380 tokens. Principle-based, no examples.

```
You are a Senior Business Analyst and Product Manager.

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
- You have access to a file: docs/plans/{date}-{topic}-requirements.md
- After each answered dimension, use the edit tool to update the relevant section in this file.
- This file is your memory. If you need to recall what has been covered, read it.

WHEN DEFINITION OF READY IS MET:
1. Read the running file to compile the full spec.
2. Present the complete Product Requirements to the user for approval.
3. On approval, state: "REQUIREMENTS APPROVED. Dispatching architect for validation and technical design."
4. Use the subagent tool to dispatch the architect with the compiled spec and the instruction: "Review this Product Requirements spec for coherence, completeness, and viability. If issues are found, list them. If sound, proceed to produce a full technical architecture design."

DO NOT:
- Provide hardcoded examples or sample products.
- Answer your own questions.
- Skip dimensions or declare DoR met prematurely.
- Ask more than one question per response.
```

---

## Running File Structure

Created when BA mode activates. Path: `docs/plans/YYYY-MM-DD-{topic}-requirements.md`

The `{topic}` is derived from the user's first message (the initial pitch). The extension creates the file with a placeholder topic; the BA renames/updates the topic in the header after the first exchange.

Initial file template:

```markdown
# Product Requirements: {topic}
**Status:** In Progress
**Date:** {date}

## 1. Problem
_Not yet covered_

## 2. Target Users
_Not yet covered_

## 3. Existing Alternatives
_Not yet covered_

## 4. Core Workflow
_Not yet covered_

## 5. Data Entities
_Not yet covered_

## 6. Scope Boundaries
_Not yet covered_

## 7. Trust & Safety
_Not yet covered_

## 8. Platform & Constraints
_Not yet covered_

## 9. MVP Cut
_Not yet covered_

## 10. Success Criteria
_Not yet covered_
```

The BA updates sections via the `edit` tool as dimensions are answered. The TUI widget reads this file to determine progress (counts sections that no longer contain `_Not yet covered_`).

---

## TUI Widget

A compact two-line widget displayed via `ctx.ui.setWidget()`:

```
BA ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 5/10
   Problem ✓  Users ✓  Alternatives ✓  Workflow ✓  Data ✓
```

Line 1: Label + progress bar + count.
Line 2: Only completed dimensions, expanding as they fill.

**Update mechanism:** The extension hooks `tool_result` events. When it detects an `edit` tool call targeting the running file, it re-reads the file and updates the widget. Passive — no extra LLM calls, no complex state management.

---

## Pipeline & Handoff Flow

```
Phase 1: Activation
  User runs /ba or starts with --ba
  → Extension sets baMode = true
  → Creates running file template
  → Shows TUI widget (0/10)
  → Injects BA system prompt on next before_agent_start

Phase 2: Conversation (all local, free)
  User pitches idea
  → BA asks one question at a time
  → BA updates running file via edit tool after each answered dimension
  → TUI widget updates (N/10)
  → BA handles tangents: absorb → capture → steer back
  → BA shows remaining dimensions in each response

Phase 3: DoR Met (10/10)
  BA reads running file
  → Compiles and presents final spec
  → User approves (or requests changes → back to Phase 2)

Phase 4: Handoff (one premium call)
  BA dispatches architect subagent with:
    Task: "Review this Product Requirements spec for coherence,
    completeness, and viability. If issues found, list them.
    If sound, proceed to technical architecture design."
    + The full compiled spec
  → Architect validates + designs
  → Results returned to session
```

---

## Extension Implementation Outline

```typescript
// extensions/orchestrator-boot.ts

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const BA_SYSTEM_PROMPT = `...`; // Full prompt from Section 3 above

const SECTION_LABELS = [
  "Problem", "Users", "Alternatives", "Workflow", "Data",
  "Scope", "Safety", "Platform", "MVP", "Success"
];

const NOT_COVERED = "_Not yet covered_";

function countCompleted(filePath: string): { completed: string[], total: number } {
  const content = fs.readFileSync(filePath, "utf-8");
  const completed = SECTION_LABELS.filter((_, i) => {
    const sectionNum = i + 1;
    const regex = new RegExp(`## ${sectionNum}\\..*\\n(?!_Not yet covered_)`);
    return regex.test(content);
  });
  return { completed, total: SECTION_LABELS.length };
}

function renderWidget(ctx: ExtensionContext, filePath: string) {
  const { completed, total } = countCompleted(filePath);
  const filled = Math.round((completed.length / total) * 20);
  const bar = "▓".repeat(filled) + "░".repeat(20 - filled);
  const line1 = `BA ${bar} ${completed.length}/${total}`;
  const line2 = completed.length > 0
    ? "   " + completed.map(s => `${s} ✓`).join("  ")
    : "   No dimensions covered yet";
  ctx.ui.setWidget("ba-progress", [line1, line2]);
}

function createRunningFile(date: string): string {
  const filePath = path.join("docs", "plans", `${date}-requirements.md`);
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, template);
  return filePath;
}

export default function (pi: ExtensionAPI) {
  let baMode = false;
  let runningFilePath: string | null = null;

  // Register --ba CLI flag
  pi.registerFlag("ba", {
    description: "Start session in Business Analyst mode",
    type: "boolean",
    default: false,
  });

  // Register /ba command
  pi.registerCommand("ba", {
    description: "Activate Business Analyst mode for this session",
    handler: async (args, ctx) => {
      if (baMode) {
        ctx.ui.notify("BA mode is already active", "warning");
        return;
      }
      baMode = true;
      const date = new Date().toISOString().split("T")[0];
      runningFilePath = createRunningFile(date);
      renderWidget(ctx, runningFilePath);
      ctx.ui.notify("BA mode activated. Pitch your idea.", "info");
    },
  });

  // Check --ba flag on session start
  pi.on("session_start", (event, ctx) => {
    if (pi.getFlag("ba")) {
      baMode = true;
      const date = new Date().toISOString().split("T")[0];
      runningFilePath = createRunningFile(date);
      renderWidget(ctx, runningFilePath);
    }
  });

  // Inject BA system prompt before every agent turn
  pi.on("before_agent_start", (event, ctx) => {
    if (!baMode) return;
    return {
      systemPrompt: BA_SYSTEM_PROMPT.replace(
        "{running_file}",
        runningFilePath ?? "docs/plans/requirements.md"
      ),
    };
  });

  // Track progress via tool_result on edit calls to running file
  pi.on("tool_result", (event, ctx) => {
    if (!baMode || !runningFilePath) return;
    if (event.toolName === "edit" &&
        (event.input as any)?.path === runningFilePath) {
      renderWidget(ctx, runningFilePath);
    }
  });
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 14B model ignores the running file instructions | Extension creates the template; prompt explicitly tells model to use `edit` tool. TUI widget staying at 0/10 makes failure visible to user. |
| Model asks multiple questions per turn | Prompt explicitly says "exactly ONE question." If persistent, can add a `tool_result` monitor that injects a warning (like the TDD monitor pattern). |
| Model declares DoR met prematurely | TUI widget shows objective truth (file state). User can see 7/10 and push back. |
| Tangent handling fails, model gets lost | Running file is source of truth. Model is instructed to read it when unsure. |
| Architect subagent call format is wrong | System prompt gives exact phrasing. Could be hardened by the extension intercepting the `subagent` tool call and injecting the spec automatically. |
| Running file topic is "TBD" after activation | BA is expected to update the title after the first exchange. If it doesn't, user sees "TBD" in the file — low-impact, easily fixed. |
