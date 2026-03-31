# Dynamic BA Boot Extension Design

**Date:** 2026-03-31
**Status:** Ready for Implementation (Revised after dual review)

## Review History

- **Review 1 (Gemini 2.5 Flash):** 2 blocking, 4 important, 3 suggestions
- **Review 2 (Claude Sonnet 4.6):** 3 blocking, 5 important, 5 suggestions
- **Combined unique findings:** 4 blocking, 5 important, 6 suggestions
- **This revision:** All blocking and important issues addressed below.

---

## Goal

### Objective
Build an `orchestrator-boot` extension for pi-superpowers-plus that transforms a local model (14B–35B range, depending on hardware fit) into a Senior Business Analyst via a dynamic system prompt, activated on-demand via `/ba` command or `--ba` CLI flag.

### Why it matters
Eliminates premium API credit consumption for the ideation and requirements-gathering phase. The local model handles all conversational BA work for free; premium credits are spent once — when the architect subagent validates and designs.

### Constraints
- System prompt ≤800 tokens (local model on 20GB VRAM, 8-16k context window). Actual token count should be verified against the model's tokenizer before claiming budget compliance.
- No hardcoded examples in the prompt (prevents semantic anchoring, saves tokens)
- Principle-based, top-down instructions only
- Must handle user tangents without losing progress
- Must stop asking questions when Definition of Ready is met

### Success signals
- Vague idea → structured Product Requirements spec through natural conversation
- No infinite question loops
- Premium model called exactly once (architect)
- Local model produces responses fast enough to maintain conversational flow

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
- State survives session restart / extension reload

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
│  4. Handoff Engine    - intercepts subagent calls,  │
│                         injects spec, enforces DoR  │
└─────────────────────────────────────────────────────┘
```

**Activator:** Registers `/ba` command and `--ba` CLI flag. When triggered, sets an internal `baMode = true` flag and persists state via `pi.appendEntry()`. This flag gates all other components — when `false`, the extension is inert.

**Prompt Injector:** Hooks `before_agent_start`. When `baMode` is true, returns a `BeforeAgentStartEventResult` with the BA system prompt (with the running file's absolute path interpolated). This *replaces* the default coding-assistant prompt for the session.

**Progress Tracker:** A two-line TUI widget (via `ctx.ui.setWidget()`, guarded by `ctx.hasUI`) showing a progress bar and completed dimensions. Updated by parsing the running file on disk when edit tool calls target it.

**Handoff Engine:** Intercepts `subagent` tool calls via `tool_call` event. When the BA attempts to dispatch the architect:
1. Checks `countCompleted() === 10` — blocks if DoR is not fully met.
2. Reads the running file and injects the full compiled spec into the subagent task programmatically, rather than trusting the local model to format it correctly.

---

## The System Prompt

~500 tokens estimated (verify with model tokenizer before finalizing). Principle-based, no examples.

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
- Ask more than one question per response.
```

**Changes from v1:**
- `{running_file}` is now the single placeholder, replaced at runtime with the absolute path.
- Explicit instruction to use the exact path string (S2 fix).
- Handoff section simplified — the extension handles spec injection, not the model (I5/S6 fix).
- Token count noted as ~500 estimated, with a requirement to verify (S5 fix).

---

## Running File Structure

Created when BA mode activates. Path: `{cwd}/docs/plans/YYYY-MM-DD-requirements.md`

Built using `path.resolve(ctx.cwd, "docs", "plans", ...)` to produce an absolute path regardless of where Node's `process.cwd()` is at call time (I2 fix).

The topic name starts as "TBD" in the file header. The BA is expected to update it via `edit` after the first exchange. If it doesn't, the impact is cosmetic only.

Initial file template:

```markdown
# Product Requirements: TBD
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

A compact two-line widget displayed via `ctx.ui.setWidget()`, guarded by `ctx.hasUI` (B3 fix):

```
BA ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 5/10
   Problem ✓  Users ✓  Alternatives ✓  Workflow ✓  Data ✓
```

Line 1: Label + progress bar + count.
Line 2: Only completed dimensions, expanding as they fill.

**Update mechanism:** The extension hooks `tool_result` events. When it detects an `edit` tool call targeting the running file (using `isEditToolResult()` type guard and `path.resolve()` comparison — B1 fix), it re-reads the file and updates the widget. Passive — no extra LLM calls, no complex state management.

---

## Pipeline & Handoff Flow

```
Phase 1: Activation
  User runs /ba or starts with --ba
  → Extension sets baMode = true
  → Persists state via pi.appendEntry() (B4 fix)
  → Creates running file template (absolute path via ctx.cwd — I2 fix)
  → Shows TUI widget (0/10) if ctx.hasUI (B3 fix)
  → Injects BA system prompt on next before_agent_start

Phase 2: Conversation (all local, free)
  User pitches idea
  → BA asks one question at a time
  → BA updates running file via edit tool after each answered dimension
  → TUI widget updates (N/10), triggered by tool_result with path.resolve() matching (B1 fix)
  → BA handles tangents: absorb → capture → steer back
  → BA shows remaining dimensions in each response

Phase 3: DoR Met (10/10)
  BA reads running file
  → Compiles and presents final spec
  → User approves (or requests changes → back to Phase 2)

Phase 4: Handoff (one premium call)
  BA calls subagent tool to dispatch architect
  → Extension intercepts via tool_call event (I4/I5 fix):
    1. Verifies countCompleted() === 10, blocks if < 10 with warning
    2. Reads running file, injects full spec into subagent task programmatically
    3. Allows the tool call to proceed with enriched payload
  → Architect validates + designs
  → Results returned to session
```

---

## State Persistence (B4 fix)

BA mode state must survive session restarts and extension reloads. Following the pattern from `workflow-monitor.ts`:

**Persist:** On activation, call `pi.appendEntry("ba_mode", { baMode: true, runningFilePath })`.

**Reconstruct:** On `session_start`, scan session entries for the latest `ba_mode` entry. If found with `baMode: true`, restore the state and re-render the widget (if the running file still exists on disk).

**Reset on session_switch:** Listen to `session_switch` and reset `baMode = false` / `runningFilePath = null` to prevent stale state leaking into a different session (S4 fix).

---

## Extension Implementation Outline

```typescript
// extensions/orchestrator-boot.ts

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
  ToolCallEvent,
} from "@mariozechner/pi-coding-agent";
import { isEditToolResult } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const BA_SYSTEM_PROMPT = `...`; // Full prompt from "The System Prompt" section above

const SECTION_LABELS = [
  "Problem", "Users", "Alternatives", "Workflow", "Data",
  "Scope", "Safety", "Platform", "MVP", "Success"
];

const NOT_COVERED = "_Not yet covered_";
const BA_STATE_ENTRY_TYPE = "ba_mode";

// --- Helpers ---

function countCompleted(filePath: string): { completed: string[], total: number } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const completed = SECTION_LABELS.filter((_, i) => {
      const sectionNum = i + 1;
      const sectionHeader = `## ${sectionNum}.`;
      const headerIdx = content.indexOf(sectionHeader);
      if (headerIdx === -1) return false;
      const nextLineStart = content.indexOf("\n", headerIdx) + 1;
      const nextLine = content.slice(nextLineStart, content.indexOf("\n", nextLineStart));
      return !nextLine.startsWith(NOT_COVERED);
    });
    return { completed, total: SECTION_LABELS.length };
  } catch {
    return { completed: [], total: SECTION_LABELS.length };
  }
}

function renderWidget(ctx: ExtensionContext, filePath: string) {
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

function createRunningFile(cwd: string, date: string): string {
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

function isRunningFilePath(eventPath: string, runningFilePath: string, cwd: string): boolean {
  return path.resolve(cwd, eventPath) === path.resolve(cwd, runningFilePath);
}

// --- Extension ---

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
      try {
        baMode = true;
        const date = new Date().toISOString().split("T")[0];
        runningFilePath = createRunningFile(ctx.cwd, date);
        pi.appendEntry(BA_STATE_ENTRY_TYPE, { baMode: true, runningFilePath });
        renderWidget(ctx, runningFilePath);
        ctx.ui.notify("BA mode activated. Pitch your idea.", "info");
      } catch (err) {
        baMode = false;
        runningFilePath = null;
        ctx.ui.notify(`Failed to activate BA mode: ${err}`, "error");
      }
    },
  });

  // Check --ba flag on session start, and reconstruct persisted state
  pi.on("session_start", (event, ctx) => {
    // Reconstruct from persisted entries
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "custom" && entry.customType === BA_STATE_ENTRY_TYPE) {
        const data = entry.data as { baMode: boolean; runningFilePath: string } | undefined;
        if (data?.baMode && data.runningFilePath && fs.existsSync(data.runningFilePath)) {
          baMode = true;
          runningFilePath = data.runningFilePath;
          renderWidget(ctx, runningFilePath);
          return;
        }
        break; // Found latest entry, but BA was deactivated or file missing
      }
    }

    // Check --ba flag for fresh activation
    if (pi.getFlag("ba")) {
      try {
        baMode = true;
        const date = new Date().toISOString().split("T")[0];
        runningFilePath = createRunningFile(ctx.cwd, date);
        pi.appendEntry(BA_STATE_ENTRY_TYPE, { baMode: true, runningFilePath });
        renderWidget(ctx, runningFilePath);
      } catch (err) {
        baMode = false;
        runningFilePath = null;
        if (ctx.hasUI) ctx.ui.notify(`Failed to activate BA mode: ${err}`, "error");
      }
    }
  });

  // Reset state on session switch
  pi.on("session_switch", (event, ctx) => {
    baMode = false;
    runningFilePath = null;
    if (ctx.hasUI) ctx.ui.setWidget("ba-progress", undefined);
  });

  // Inject BA system prompt before every agent turn
  pi.on("before_agent_start", (event, ctx) => {
    if (!baMode || !runningFilePath) return;
    return {
      systemPrompt: BA_SYSTEM_PROMPT.replace("{running_file}", runningFilePath),
    };
  });

  // Track progress via tool_result on edit calls to running file
  pi.on("tool_result", (event, ctx) => {
    if (!baMode || !runningFilePath) return;
    if (isEditToolResult(event) && isRunningFilePath(event.input.path, runningFilePath, ctx.cwd)) {
      renderWidget(ctx, runningFilePath);
    }
  });

  // Handoff Engine: intercept subagent calls to enforce DoR and inject spec
  pi.on("tool_call", (event, ctx) => {
    if (!baMode || !runningFilePath) return;
    if (event.toolName !== "subagent") return;

    const input = event.input as Record<string, unknown>;
    const agent = input.agent as string | undefined;
    if (agent !== "architect" && agent !== "implementer") return;

    // Enforce DoR completion
    const { completed, total } = countCompleted(runningFilePath);
    if (completed.length < total) {
      return {
        block: true,
        reason: `DoR not met: ${completed.length}/${total} dimensions covered. ` +
          `Missing: ${SECTION_LABELS.filter(s => !completed.includes(s)).join(", ")}. ` +
          `Continue the conversation to cover remaining dimensions before dispatching.`,
      };
    }

    // Read the running file and inject the full spec into the task
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
}
```

**Key changes from v1:**
- **B1:** Uses `isEditToolResult()` type guard + `path.resolve()` comparison via `isRunningFilePath()` helper
- **B2:** Prompt uses `{running_file}` as single placeholder; code replaces it with the absolute path
- **B3:** All `ctx.ui.*` calls guarded by `ctx.hasUI`
- **B4:** State persisted via `pi.appendEntry()`, reconstructed on `session_start` from session entries
- **I1:** `countCompleted()` uses `indexOf()` string search instead of broken regex
- **I2:** `createRunningFile()` uses `path.resolve(cwd, ...)` for absolute paths
- **I3:** All file operations wrapped in try/catch with user-facing error notifications
- **I4:** Handoff engine intercepts `subagent` tool call and injects spec programmatically — the local model only needs to call the tool, not format the payload
- **I5:** `tool_call` handler enforces `countCompleted() === 10` before allowing architect dispatch

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Local model ignores running file instructions | Extension creates the template; prompt explicitly tells model to use `edit` tool with exact path. TUI widget staying at 0/10 makes failure visible. |
| Model asks multiple questions per turn | Prompt explicitly says "exactly ONE question." If persistent, can add a `turn_end` monitor that injects a warning (like the TDD monitor pattern). |
| Model declares DoR met prematurely | Extension **enforces** DoR via `tool_call` interception: blocks architect dispatch if < 10/10 and tells model which dimensions are missing. TUI widget shows objective truth. |
| Tangent handling fails, model gets lost | Running file is source of truth. Model is instructed to read it when unsure. |
| Architect subagent call format is wrong | Extension intercepts the `tool_call` and **injects the spec programmatically** from the running file. The model only needs to call the subagent tool; it doesn't need to format the payload correctly. |
| Running file topic is "TBD" after activation | BA is expected to update the title after the first exchange. If it doesn't, user sees "TBD" in the file — low-impact, easily fixed. |
| State lost on session restart | State persisted via `pi.appendEntry()` and reconstructed on `session_start`. |
| Stale state leaks to different session | `session_switch` handler resets `baMode` and clears widget. |
| `subagent` tool not available to local model | The tool is registered by the subagent extension (part of pi-superpowers-plus). It will be in the tool registry for any session using these extensions. The local model receives tool schemas like any other model. **Verified:** tool registration is model-agnostic. |
| Widget line 2 overflows at 10/10 | At 10/10 (~95 chars) fits standard 120-col terminals. For narrower terminals, could truncate to abbreviations in a future iteration. |

---

## Appendix: Review Findings Addressed

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| B1 | 🔴 | Path comparison bug (relative vs absolute, `as any` cast) | `isEditToolResult()` guard + `path.resolve()` comparison |
| B2 | 🔴 | Prompt placeholder mismatch (`{running_file}` vs `{date}-{topic}`) | Unified to `{running_file}` placeholder throughout |
| B3 | 🔴 | Missing `ctx.hasUI` guard on `setWidget()` | Guard added to all `ctx.ui.*` calls in event handlers |
| B4 | 🔴 | State persistence (in-memory only) | `pi.appendEntry()` + reconstruction on `session_start` |
| I1 | 🟡 | Regex `\\n` bug in `countCompleted()` | Replaced with `indexOf()` string search |
| I2 | 🟡 | Relative path for file creation | `path.resolve(ctx.cwd, ...)` throughout |
| I3 | 🟡 | No error handling on file ops | try/catch with `ctx.ui.notify("error")` |
| I4 | 🟡 | `subagent` tool availability unverified | Verified: tool registration is model-agnostic. Added programmatic spec injection. |
| I5 | 🟡 | No DoR enforcement before dispatch | `tool_call` interception blocks if < 10/10 |
