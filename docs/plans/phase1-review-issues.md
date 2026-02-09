# Phase 1 Review Issues

Post-review issues from the TDD enforcement implementation (`feat/tdd-enforcement`).
Address in Phase 2 or a follow-up patch.

---

## Important

### 1. Silent source write in RED phase
- **File:** `extensions/workflow-monitor/tdd-monitor.ts:35-36`
- **Issue:** Writing source while in RED phase does nothing — no transition, no warning. User wrote a test (→RED), then writes source before running tests. State stays RED silently.
- **Expected:** Either transition to REFACTOR, or emit a warning ("run your failing test before writing production code").
- **Decision needed:** Is this strict TDD (correct) or a UX gap? Document or fix.

### 2. Module-level pendingViolation state
- **File:** `extensions/workflow-monitor.ts:17`
- **Issue:** `pendingViolation` is scoped to the module closure, not the handler instance. If pi ever processes `tool_call` and `tool_result` events concurrently, violations could leak between calls.
- **Fix:** Move into the `WorkflowHandler` interface or document the sequential-processing assumption.

### 3. Package root discovery fragility
- **File:** `extensions/workflow-monitor/reference-tool.ts:25-33`
- **Issue:** `getPackageRoot()` walks up directories looking for `package.json`. May resolve to the wrong root in monorepos or when the package is installed as a dependency.
- **Fix:** Accept an explicit root path at init time, or resolve relative to `import.meta.url` with a known depth.

### 4. Duplicate regex pattern in heuristics
- **File:** `extensions/workflow-monitor/heuristics.ts:3,7`
- **Issue:** `TEST_PATTERNS` includes both `/^tests?\//` (matches `test/` or `tests/` at start) and `/\/tests?\//` (matches `/test/` or `/tests/` mid-path). The first is not redundant but the coverage overlaps. Worth consolidating.
- **Fix:** Merge into a single pattern or document why both are needed.

---

## Minor

### 5. Generic pass pattern false positives
- **File:** `extensions/workflow-monitor/test-runner.ts:22`
- **Issue:** `/\bpassed\b/i` matches any output containing "passed" — could false-positive on non-test command output (e.g., "all checks passed").
- **Mitigation:** Only evaluated when `parseTestCommand` already matched, so risk is low. Consider tightening patterns later.

### 6. No state persistence across sessions
- **File:** `extensions/workflow-monitor.ts:29-35`
- **Issue:** TDD monitor resets to idle on every session event. Long-running TDD cycles that span session switches lose state.
- **Fix:** Persist TDD state in tool result details (like plan-tracker does) and reconstruct on session events.

### 7. Loose type on warning function
- **File:** `extensions/workflow-monitor/warnings.ts:3`
- **Issue:** `getTddViolationWarning(type: string, ...)` accepts any string but only handles `"source-before-test"`. Should use a discriminated union.
- **Fix:** `type: TddViolation["type"]` or a string literal union.
