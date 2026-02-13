# Warning Escalation & Skill Boundary Enforcement

**Date:** 2026-02-13
**Status:** Design

## Problem

The workflow monitor injects warnings into tool results when the agent violates guardrails (TDD, branch safety, phase skipping). However, agents can and do ignore these warnings entirely — editing code repeatedly despite multiple ⚠️ messages. The skills themselves also lack explicit boundaries about what actions are in/out of scope for each phase.

## Design

### 1. Skill Boundaries — "Thinking" Phase Skills

Add a short **Boundaries** section to skills where the agent should NOT be editing source code:

- **brainstorming** 
- **writing-plans**
- **verification-before-completion** (reads/runs commands, doesn't edit)

Content (adapt per skill):

```
## Boundaries
- Reading code and docs: yes
- Writing design/plan docs: yes
- Editing or creating source code: no
```

### 2. Skill Prerequisites — "Doing" Phase Skills

Add a **Prerequisites** note to skills where implementation happens:

- **test-driven-development**
- **executing-plans**
- **subagent-driven-development**

Content (adapt per skill):

```
## Prerequisites
- Active branch (not main) or user-confirmed intent to work on main
- Approved plan or clear task scope
```

### 3. Warning Respect Line — "Doing" Phase Skills Only

Add one line to all doing-phase skills:

- **test-driven-development**
- **executing-plans**
- **subagent-driven-development**
- **systematic-debugging**
- **verification-before-completion**

Content:

```
If a tool result contains a ⚠️ workflow warning, stop immediately and address it before continuing.
```

This line is NOT needed on thinking-phase skills (brainstorming, writing-plans) because their boundaries already prevent the actions that trigger warnings.

### 4. Extension Escalation — Two-Bucket Strike Counter (Option C)

#### Violation Categories

**Process violations** (you skipped the workflow):
- Wrong phase (e.g., editing code during brainstorming)
- No branch (writing to main without confirmation)
- No plan (jumping to implementation without a plan)

**Practice violations** (you're coding wrong):
- TDD violation (production code before/without failing test)
- Debug violation (guessing fixes without investigation)
- Verification violation (claiming success without running checks)

#### Escalation Behavior

1. **First violation in a bucket:** Soft warning injected into tool result (current behavior). Counter for that bucket increments to 1.

2. **Second violation in same bucket:** Hard block. The edit/write is prevented. A `ui.select` prompt is shown to the user:
   - Prompt: "Agent has repeatedly violated [process/practice] guardrails: [list violations]. Allow it to continue?"
   - **Yes, continue** — counter resets for that bucket, agent proceeds
   - **No, stop** — action stays blocked

#### Counter Scope

- Counters are **per-session** (reset on session switch)
- Each bucket (process, practice) has its own independent counter
- User override (selecting "Yes, continue") resets that bucket's counter

#### Implementation Notes

- The `onToolResult` hook already injects warnings — extend it to track counts
- On second strike, return `{ blocked: true }` instead of just appending warning text
- The `ui.select` prompt uses plain string arrays (not objects) per the API: `ctx.ui.select("...", ["Yes, continue", "No, stop"])`
- Store counters in the extension's in-memory state (no persistence needed — session-scoped)

### 5. Fix Existing ui.select Bug

All current `ui.select` calls pass `{ label, value }` objects instead of plain strings, causing `[object Object]` to display as choices. Fix all 7 call sites in `workflow-monitor.ts` to pass string arrays and map the returned label back to the intended value.

## Skills Affected

| Skill | Change |
|-------|--------|
| brainstorming | Add Boundaries section |
| writing-plans | Add Boundaries section |
| verification-before-completion | Add Boundaries section + warning respect line |
| test-driven-development | Add Prerequisites + warning respect line |
| executing-plans | Add Prerequisites + warning respect line |
| subagent-driven-development | Add Prerequisites + warning respect line |
| systematic-debugging | Add warning respect line |
| dispatching-parallel-agents | No change (already well-guarded) |
| finishing-a-development-branch | No change (already has verification gates) |
| receiving-code-review | No change (already has "STOP" instruction) |
| requesting-code-review | No change |
| using-git-worktrees | No change |

## Out of Scope

- Shared skill includes (pi doesn't support them — each skill is self-contained)
- Cross-session violation tracking (counters reset per session)
- Changing the workflow phase model itself
