# Workflow Tracker Reset & Brainstorm Git Protection

**Date:** 2026-02-20
**Status:** Design complete

## Problem

1. **No workflow reset:** The workflow tracker persists phase state across sessions via `.pi/superpowers-state.json`. When starting a new task, stale state from the prior task remains — phases show as "complete" or "skipped" from an unrelated workflow.

2. **"Active" treated as unresolved:** `isPhaseUnresolved()` treats both "pending" and "active" as unresolved. When a phase is worked on in session 1 (status = "active") and the next skill is invoked in session 2, skip-confirmation fires incorrectly.

3. **Brainstorm starts without git check:** The brainstorming skill dives straight into questions without checking if the current branch has unmerged/uncommitted work from a prior task.

## Design

### 1. `WorkflowTracker.reset()`

New method that sets all phases to "pending" and clears `currentPhase`. Called by both reset triggers below.

### 2. Auto-reset on backward navigation

In `advanceTo()`: if the target phase index is ≤ the current phase index (backward or same-phase re-entry), call `reset()` first, then activate the target phase normally.

Example: workflow is at "finish", user invokes `/skill:brainstorming` → detects backward navigation → reset → activate "brainstorm".

### 3. `/workflow reset` command

Detected in the input handler (same place `/skill:` is parsed). Calls `tracker.reset()`, persists state, confirms to the user.

### 4. Fix `isPhaseUnresolved`

Change to only treat "pending" as unresolved. "Active" means the user engaged with the phase — it should not trigger skip-confirmation.

**File:** `extensions/workflow-monitor/skip-confirmation.ts`

```ts
// Before
export function isPhaseUnresolved(status: PhaseStatus): boolean {
  return status === "pending" || status === "active";
}

// After
export function isPhaseUnresolved(status: PhaseStatus): boolean {
  return status === "pending";
}
```

### 5. Brainstorm skill git protection

Add to the top of the brainstorming `SKILL.md` process, before "Understanding the idea":

> **Before anything else — check git state:**
> - Run `git status` and `git log --oneline -5`
> - If on a feature branch with uncommitted or unmerged work, ask the user:
>   - "You're on `feat/old-thing` with uncommitted changes. Want to finish that first, stash it, or continue here?"
> - If starting a new topic, suggest creating a new branch

## Files to change

| File | Change |
|------|--------|
| `extensions/workflow-monitor/workflow-tracker.ts` | Add `reset()` method |
| `extensions/workflow-monitor/workflow-tracker.ts` | Update `advanceTo()` — backward navigation triggers reset |
| `extensions/workflow-monitor/workflow-handler.ts` | Detect `/workflow reset` command |
| `extensions/workflow-monitor/skip-confirmation.ts` | `isPhaseUnresolved` — remove "active" check |
| `skills/brainstorming/SKILL.md` | Add git state check before starting |
| Tests for each of the above | |
