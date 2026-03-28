# Dynamic Subagent Model Selection Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add deterministic, capability-aware dynamic model selection to `subagent`, with grade-based assignment, availability fallback, visible selection reasons, telemetry, and an autoresearch loop for policy refinement.

**Architecture:** Introduce a shared model catalog and selection policy under `extensions/subagent/`, grade tasks using simple inspectable heuristics plus optional override, and choose the lowest-cost eligible available model using per-agent overlays. Persist local telemetry for later evidence-backed promotion, and add a scenario-based eval script so the policy can be tuned in an autoresearch lane without changing runtime behavior ad hoc.

**Tech Stack:** TypeScript, Vitest, existing `subagent` extension, JSON policy/telemetry artifacts, Node scripts

**Execution Mode:** autoresearch

## Goal Summary
- **Objective:** Pick the cheapest available model that still satisfies the task's capability needs for each subagent invocation.
- **Why it matters:** Fixed model pins break on unavailable models and waste cost on easier tasks; dynamic assignment should preserve quality while reducing avoidable spend.
- **Constraints:** Capability floor before cost; deterministic runtime behavior; no silent downgrade below floor; guarded rollout; local telemetry must not block execution.
- **Success signals:** Dynamic selection works for single-mode subagent calls; grade suggestion + override work; unavailable models fall back safely; selection reasons are visible; policy evals show lower weighted cost with no floor violations.
- **Verification checks:** New Vitest coverage for grading/selection/fallback/telemetry; integration tests preserve existing disabled-path behavior; policy eval script reports zero capability-floor violations and improved or equal weighted cost against baseline.
- **Scope / Off-limits:** In scope: `extensions/subagent/**`, bundled agents, tests, policy/eval artifacts, relevant docs. Off-limits: workflow monitor redesign, messenger-swarm integration, opaque online learning.
- **Stop conditions:** Stop if capability schema becomes unstable, selector becomes hard to explain, or eval corpus cannot distinguish better vs worse policies.

## Autoresearch Overlay
- **Metric / direction:** Minimize weighted selected cost tier while preserving 100% capability-floor compliance on the scenario corpus.
- **Benchmark command:** `node scripts/subagent-policy-eval.mjs`
- **Correctness command:** `npx vitest run tests/extension/subagent/`
- **Files in scope:** `extensions/subagent/**`, `agents/*.md`, `tests/extension/subagent/**`, `scripts/subagent-policy-eval.mjs`, `docs/subagent-model-selection.md`
- **Experiment stop conditions:** Stop if any policy candidate introduces a floor violation, changes fallback behavior incorrectly, or cannot beat the baseline cost score beyond noise.

---

### Task 1: Add model policy schema and catalog

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Create: `extensions/subagent/model-policy.ts`
- Create: `tests/extension/subagent/model-policy.test.ts`
- Create: `tests/extension/subagent/model-policy-fixtures.ts`

**Step 1: Write the failing tests**
- Define tests for:
  - parsing a shared model profile vocabulary
  - validating ordered capability levels
  - validating ordered cost tiers
  - resolving per-agent overlays by agent type + grade
  - rejecting malformed policy entries

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/extension/subagent/model-policy.test.ts`
Expected: FAIL with missing module / missing exports.

**Step 3: Implement minimal policy module**
Implement in `extensions/subagent/model-policy.ts`:
- grade union: `light | standard | heavy | deep`
- ordinal capability unions
- model profile type
- per-agent overlay type
- baseline bundled policy object
- helpers for comparing levels and resolving requirements

**Step 4: Run tests to verify they pass**
Run: `npx vitest run tests/extension/subagent/model-policy.test.ts`
Expected: PASS

**Step 5: Commit**
Run:
```bash
git add extensions/subagent/model-policy.ts tests/extension/subagent/model-policy.test.ts tests/extension/subagent/model-policy-fixtures.ts
git commit -m "feat: add subagent model policy schema"
```

### Task 2: Add task grading with optional override

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Create: `extensions/subagent/task-grading.ts`
- Create: `tests/extension/subagent/task-grading.test.ts`
- Modify: `extensions/subagent/index.ts`

**Step 1: Write the failing tests**
Cover:
- heuristic suggestion of `light`, `standard`, `heavy`, `deep`
- final grade prefers explicit override when provided
- grading remains deterministic for the same prompt/context
- single-mode params accept `grade` and `model` override fields
- parallel/chain task item types can carry the same metadata even if rollout is initially gated

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/extension/subagent/task-grading.test.ts`
Expected: FAIL with missing module / schema mismatch.

**Step 3: Implement minimal grading + schema plumbing**
- Add grading helpers in `extensions/subagent/task-grading.ts`
- Extend `SubagentParams`, `TaskItem`, and `ChainItem` with optional `grade` and `model`
- Thread suggested grade and override into the internal invocation request structure

**Step 4: Run tests to verify they pass**
Run: `npx vitest run tests/extension/subagent/task-grading.test.ts`
Expected: PASS

**Step 5: Commit**
Run:
```bash
git add extensions/subagent/task-grading.ts extensions/subagent/index.ts tests/extension/subagent/task-grading.test.ts
git commit -m "feat: add task grading and subagent overrides"
```

### Task 3: Add deterministic model selector and availability fallback

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Create: `extensions/subagent/model-selector.ts`
- Create: `tests/extension/subagent/model-selector.test.ts`
- Modify: `extensions/subagent/index.ts`

**Step 1: Write the failing tests**
Cover:
- filtering by capability floor
- ranking eligible models by cost tier then speed then stable tie-breaker
- preserving capability-first semantics
- immediate fallback to next eligible model when selected model is unavailable
- explicit error when no eligible model exists
- visible selection details include agent, suggested grade, final grade, selected model, fallback/override reason

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/extension/subagent/model-selector.test.ts`
Expected: FAIL with missing module / missing functions.

**Step 3: Implement minimal selector**
- Add selector helpers in `extensions/subagent/model-selector.ts`
- Add availability check abstraction that can be tested deterministically
- Integrate selector into `runSingleAgent()` before args construction
- Only enable dynamic selection when rollout guard is on; otherwise preserve existing behavior

**Step 4: Run tests to verify they pass**
Run: `npx vitest run tests/extension/subagent/model-selector.test.ts`
Expected: PASS

**Step 5: Commit**
Run:
```bash
git add extensions/subagent/model-selector.ts extensions/subagent/index.ts tests/extension/subagent/model-selector.test.ts
git commit -m "feat: add deterministic subagent model selection"
```

### Task 4: Add guarded single-mode rollout and regression coverage

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `extensions/subagent/index.ts`
- Create: `tests/extension/subagent/dynamic-selection-rollout.test.ts`
- Create: `tests/extension/subagent/model-fallback.test.ts`

**Step 1: Run existing subagent tests first**
Run: `npx vitest run tests/extension/subagent/`
Expected: PASS

**Step 2: Write the failing tests**
Cover:
- dynamic selection disabled preserves current static/default behavior
- single-mode dynamic selection enabled path works
- parallel/chain metadata plumbing exists but selection rollout remains guarded if specified
- unavailable pinned model falls back correctly when enabled

**Step 3: Run tests to verify they fail**
Run: `npx vitest run tests/extension/subagent/dynamic-selection-rollout.test.ts tests/extension/subagent/model-fallback.test.ts`
Expected: FAIL on missing guard / missing fallback behavior.

**Step 4: Implement rollout guard**
- Add a single source of truth for rollout enablement (for example env var or policy flag)
- Route single-mode through dynamic selector when enabled
- Leave parallel/chain architecture-ready but behaviorally conservative until later expansion

**Step 5: Run targeted and full subagent tests**
Run:
```bash
npx vitest run tests/extension/subagent/dynamic-selection-rollout.test.ts tests/extension/subagent/model-fallback.test.ts
npx vitest run tests/extension/subagent/
```
Expected: PASS

**Step 6: Commit**
Run:
```bash
git add extensions/subagent/index.ts tests/extension/subagent/dynamic-selection-rollout.test.ts tests/extension/subagent/model-fallback.test.ts
git commit -m "feat: guard dynamic model selection rollout"
```

### Task 5: Add local telemetry for evidence-backed refinement

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Create: `extensions/subagent/telemetry.ts`
- Create: `tests/extension/subagent/telemetry.test.ts`
- Modify: `extensions/subagent/index.ts`

**Step 1: Write the failing tests**
Cover:
- telemetry record format
- best-effort writes that do not block execution
- storing suggested grade, final grade, selected model, fallback, override, success/failure, latency, retries/rework placeholders, and usage
- local-first storage path behavior

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/extension/subagent/telemetry.test.ts`
Expected: FAIL with missing module / write behavior.

**Step 3: Implement minimal telemetry**
- Add telemetry helpers in `extensions/subagent/telemetry.ts`
- Persist append-only JSONL or similar local records under a deterministic path
- Emit telemetry after each completed subagent run
- Swallow write failures after logging a warning

**Step 4: Run tests to verify they pass**
Run: `npx vitest run tests/extension/subagent/telemetry.test.ts`
Expected: PASS

**Step 5: Commit**
Run:
```bash
git add extensions/subagent/telemetry.ts extensions/subagent/index.ts tests/extension/subagent/telemetry.test.ts
git commit -m "feat: log subagent model selection telemetry"
```

### Task 6: Add policy eval script and promotion scaffolding

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Create: `extensions/subagent/promotion.ts`
- Create: `tests/extension/subagent/promotion.test.ts`
- Create: `scripts/subagent-policy-eval.mjs`
- Create: `tests/extension/subagent/policy-eval-fixtures.ts`

**Step 1: Write the failing tests**
Cover:
- promotion proposal classification into low-risk vs review-required
- cost-score comparison against a baseline policy
- floor-violation detection
- stable eval output for a fixed scenario corpus

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/extension/subagent/promotion.test.ts`
Expected: FAIL with missing module / missing script helpers.

**Step 3: Implement minimal eval + promotion helpers**
- Add promotion classification helpers in `extensions/subagent/promotion.ts`
- Add fixture corpus for representative agent+grade scenarios
- Add `scripts/subagent-policy-eval.mjs` to compute:
  - weighted cost score
  - floor violations
  - fallback counts
  - recommendation summary

**Step 4: Run tests and eval**
Run:
```bash
npx vitest run tests/extension/subagent/promotion.test.ts
node scripts/subagent-policy-eval.mjs
```
Expected: PASS tests; eval prints baseline metrics with zero floor violations.

**Step 5: Commit**
Run:
```bash
git add extensions/subagent/promotion.ts tests/extension/subagent/promotion.test.ts tests/extension/subagent/policy-eval-fixtures.ts scripts/subagent-policy-eval.mjs
git commit -m "feat: add subagent policy eval and promotion scaffolding"
```

### Task 7: Update bundled agents and docs for dynamic selection

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `agents/implementer.md`
- Modify: `agents/code-reviewer.md`
- Modify: `agents/spec-reviewer.md`
- Modify: `agents/worker.md`
- Create: `docs/subagent-model-selection.md`
- Modify: `README.md`

**Step 1: Run relevant tests first**
Run: `npx vitest run tests/extension/subagent/`
Expected: PASS

**Step 2: Write/adjust failing tests if documentation or agent discovery behavior changes**
- If agent frontmatter changes require discovery updates, add or adjust tests accordingly.

**Step 3: Implement minimal docs/profile updates**
- Remove or relax hardcoded bundled model pins in favor of dynamic selection defaults
- Document grade override, model override, rollout guard, fallback, telemetry, and eval flow
- Document the A → B → C evolution and hybrid promotion expectations

**Step 4: Run verification commands**
Run:
```bash
npx vitest run tests/extension/subagent/
node scripts/subagent-policy-eval.mjs
```
Expected: PASS tests; eval shows zero floor violations and stable baseline-or-better weighted cost score.

**Step 5: Commit**
Run:
```bash
git add agents/implementer.md agents/code-reviewer.md agents/spec-reviewer.md agents/worker.md docs/subagent-model-selection.md README.md
git commit -m "docs: describe dynamic subagent model selection"
```

## Autoresearch Execution Notes

Use the policy eval script as the keep/discard loop during execution.

For each policy candidate:
1. Run `node scripts/subagent-policy-eval.mjs`
2. Reject immediately if any capability-floor violation appears
3. Prefer candidates that lower weighted cost tier without increasing fallback problems
4. Re-run `npx vitest run tests/extension/subagent/` before accepting a candidate
5. Only promote low-risk reorderings automatically; require review for capability-floor or classification changes

## Final Verification

Run:
```bash
npx vitest run tests/extension/subagent/
node scripts/subagent-policy-eval.mjs
```

Expected:
- All subagent tests PASS
- Eval reports zero floor violations
- Dynamic selection is visible, deterministic, and lower-cost-or-equal versus baseline on the scenario corpus
