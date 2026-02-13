# Polish Pass: Review Leftovers + Behavioral Fixes

**Date:** 2026-02-13
**Branch:** `feature/warning-escalation-guardrails`
**Status:** Approved

## Scope

One combined pass covering 4 buckets of fixes to the workflow-monitor extension:

1. **5 code review leftovers** — surgical fixes from 2026-02-13 review
2. **Escalation "allow for session"** — add option to suppress further prompts per bucket
3. **Workflow tracker phase detection** — parse `<skill name="...">` XML in input
4. **False skip warning after verification** — consequence of #3, fixed by same change

## Bucket 1: Code Review Leftovers

From `docs/reviews/2026-02-13-warning-escalation-and-skill-boundaries-review-results.md`:

1. **Cache `getWorkflowState()` in tool_call handler** — fetch once and reuse instead of repeated calls
2. **Absolute paths bypass `docs/plans/` allowlist** — only `./` is stripped; must also handle full absolute paths
3. **Practice escalation skipped in thinking phases** — intentional but undocumented; add inline comment
4. **`normalizedPath` leaks into `handleFileWritten()`** — fix normalization side-effect
5. **Strike counter increments in non-interactive mode** — guard behind `ctx.hasUI` check

## Bucket 2: Escalation "Allow for Session"

**Problem:** `maybeEscalate()` resets the strike counter to 0 on "Yes, continue," so every 2 additional violations trigger another prompt. During subagent execution, this becomes a click-fest.

**Fix:** Change the select prompt from 2 options to 3:
- "Yes, continue" — reset counter, allow this time (existing behavior)
- "Yes, allow all for this session" — set `sessionAllowed[bucket] = true`, bypass all future escalation for this bucket
- "No, stop" — block (existing behavior)

Implementation:
- Add `sessionAllowed: Partial<Record<ViolationBucket, boolean>>` alongside the existing `strikes` object
- At the top of `maybeEscalate()`, check `if (sessionAllowed[bucket]) return "allow"` before incrementing strikes

## Bucket 3: Workflow Tracker Phase Detection

**Problem:** `onInputText` uses regex `/^\s*\/skill:([^\s]+)/` to detect skill invocations. But pi expands `/skill:name` into `<skill name="name" location="...">...</skill>` before the input event fires. The regex never matches.

**Consequence:** Only the "execute" phase works (triggered by `plan_tracker` init tool call). Brainstorm, plan, verify, review, and finish phases are never detected from input.

**Fix:** Add a second regex to `onInputText`:
```typescript
const xmlMatch = line.match(/<skill\s+name="([^"]+)"/);
```
Map matched skill names to phases using the existing `SKILL_PHASE_MAP`. Same code path, just two patterns instead of one.

## Bucket 4: False Skip Warning After Verification

**Problem:** After completing a verification pass, invoking code review triggers a "you skipped verification" warning.

**Root cause:** Same as Bucket 3 — the verify phase was never recorded because the skill XML wasn't detected.

**Fix:** Resolved by Bucket 3's fix. No additional work needed.

## Testing Strategy

### Review leftovers:
- Test absolute path bypass: `/home/pi/.../docs/plans/foo.md` is correctly allowed
- Test strike counter doesn't increment when `ctx.hasUI` is false

### Escalation "allow for session":
- Test that "allow all" sets session flag and subsequent violations return "allow" without prompting
- Test that the flag is per-bucket (allowing TDD violations doesn't suppress debug violations)

### Phase detection:
- Test `onInputText` with `<skill name="brainstorming" location="...">` triggers brainstorm phase
- Test `onInputText` with `<skill name="verification-before-completion"` triggers verify phase
- Test full sequence (brainstorm → plan → execute → verify → review) advances phases correctly with no false skip warnings

### Regression:
- Run full existing test suite

## Out of Scope

- **Debug logging** — cross-cutting concern, separate spec to follow
- **Older review items** from phase1/phase2 reviews — tracked separately
