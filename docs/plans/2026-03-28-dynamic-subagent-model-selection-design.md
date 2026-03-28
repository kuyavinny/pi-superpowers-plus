# Dynamic Subagent Model Selection Design

## Goal

### Objective
Add deterministic, capability-aware dynamic model selection for `subagent` so agent runs use the cheapest available model that still meets the task's capability needs.

### Why it matters
Bundled agents currently pin a single model, which breaks for operators who do not have that model and leaves cost/performance optimization on the table. The system should remain explainable and stable while learning from prior runs.

### Constraints
- Capability floor must be enforced before cost optimization.
- Runtime selection must stay deterministic, fast, and inspectable.
- Fallbacks must never silently choose a model below the required capability floor.
- Provider/model availability differs by operator environment.
- Initial rollout should be guarded and low-risk.

### Success signals
- A subagent call can select a model dynamically instead of relying on a hardcoded frontmatter model.
- The system can suggest a task grade and optionally accept an override.
- Operators can see the selected model, grade, and fallback/override reason in results.
- Unavailable models fall back cleanly to the next eligible option.
- Telemetry is captured for later policy refinement.

### Verification checks
- Unit tests cover grading, selection, ranking, fallback, override behavior, and telemetry.
- Integration tests prove existing `subagent` flows still work when dynamic selection is disabled.
- Guarded rollout proves single-mode calls first, with architecture ready for parallel/chain later.
- Policy/eval fixtures demonstrate that capability floors are preserved while lower-cost eligible models are preferred.

### Tradeoffs
- Slightly more configuration and telemetry complexity is acceptable.
- Opaque black-box runtime learning is not acceptable.
- Mildly conservative early selection is acceptable if it avoids underpowered model choices.

### Scope / Off-limits
- In scope: `extensions/subagent/**`, bundled agent definitions, tests, policy/eval fixtures, and docs for subagent usage.
- Out of scope: redesigning the entire workflow system, replacing `subagent` with messenger-swarm, or building a fully autonomous online learner.

### Artifacts
- design doc
- autoresearch-oriented implementation plan
- policy schema
- grading/selection tests
- telemetry format
- promotion/eval fixtures

### Execution mode hint
autoresearch

### Stop conditions
- If capability dimensions cannot be defined in a stable way, stop and simplify the schema.
- If dynamic selection becomes opaque or too hard to explain, stop and reduce scope.
- If benchmark/eval fixtures cannot distinguish good from bad policy choices, stop and revisit the measurement plan.

---

## Summary

This feature should be built as a deterministic model-selection subsystem for `subagent`, not as a vague smart router. The runtime path stays simple: infer or accept a task grade, resolve a required capability profile for the agent type, select the lowest-cost eligible available model, and surface the decision in the result. Learning from prior runs should not directly mutate runtime behavior; it should produce policy evidence and promotion proposals that update a reviewed ruleset.

The long-term path is intentionally staged:
- **A:** deterministic policy engine
- **B:** benchmark-calibrated policy
- **C:** learned policy updates from prior runs, promoted through controlled rules changes

This gives the project a fast runtime path, explainable operator experience, and a credible route to smarter future selection without runtime unpredictability.

## Architecture

### 1. Runtime selection plane
The runtime selector receives:
- agent type (`implementer`, `code-reviewer`, `spec-reviewer`, `worker`)
- task text and context
- suggested task grade
- optional override(s)
- model catalog and policy overlay
- availability signals

It computes the final grade, resolves the required capability floor, filters eligible models, ranks them deterministically, and selects the best candidate. If the selected model is unavailable, it falls back to the next eligible ranked option without weakening the floor.

### 2. Learning plane
Each run logs structured telemetry:
- agent type
- suggested and final grade
- selected model
- fallback or override usage
- success/failure
- retries/rework counts
- latency
- token/cost usage

This data is local-first so it reflects the operator's actual environment.

### 3. Promotion plane
Policy changes are promoted from evidence, not improvised at runtime.
- **Low-risk updates** may auto-promote.
- **High-impact updates** require review.

Examples:
- reorder two models within the same capability band after strong evidence
- demote a model that causes high retry/rework rates for a particular agent+grade

## Shared Schema + Per-Agent Overlays

The system should use one shared policy vocabulary across all models and agents, with role-specific overlays for requirements.

### Shared model profile
Each model should be described with ordinal dimensions such as:
- `reasoning`
- `codingReliability`
- `reviewDepth`
- `speed`
- `costTier`

Suggested v1 values:
- capability dimensions: `low | medium | high | very_high`
- cost tier: `cheap | moderate | expensive | premium`

This keeps the policy readable and avoids pretending cross-provider prices are perfectly comparable in numeric form.

### Shared task grades
All agent types use the same grade set:
- `light`
- `standard`
- `heavy`
- `deep`

### Per-agent overlays
Each agent type defines required floors per grade. Example shape:
- `implementer + heavy` requires stronger `codingReliability`
- `code-reviewer + heavy` requires stronger `reviewDepth` and `reasoning`
- `spec-reviewer + standard` may tolerate lower coding needs but still require solid reasoning

This avoids four unrelated systems while preserving role-specific tuning.

## Task Grading Model

Task grading should be hybrid:
- system computes a **suggested grade**
- orchestrator may apply an **optional override**
- the final grade is recorded alongside the suggestion

### Grade semantics
- **light** — narrow, local, bounded task
- **standard** — normal file/subsystem scoped task
- **heavy** — multi-file, broader context, or elevated risk task
- **deep** — architecture-sensitive, broad-context, or high-consequence task

### Suggested-grade heuristics
The v1 grader should be intentionally simple and inspectable. Inputs may include:
- prompt length and density
- number of referenced files/components
- implementation vs review task type
- words suggesting architecture/system-wide impact
- whether the task requests broad feature review vs a local check

The goal is consistency and explainability, not perfect inference.

## Runtime Selection Algorithm

The runtime algorithm should be deterministic and ordered:

1. Compute suggested grade.
2. Apply optional override to get final grade.
3. Resolve agent overlay for the agent type + grade.
4. Filter model catalog to only available models meeting the required capability floor.
5. Rank eligible models using deterministic weighted order:
   1. meets/exceeds required floor
   2. availability
   3. lower cost tier
   4. better expected speed/latency
   5. stable tie-breaker preference
6. Select the top-ranked model.
7. If unavailable at invocation time, retry with the next eligible ranked model.
8. If no eligible model remains, fail clearly with required profile and rejection reasons.

This keeps capability first, cost second, speed third.

## Operator Visibility

Model selection should be visible by default in subagent output. Every invocation should surface:
- agent type
- suggested grade
- final grade
- selected model
- override usage
- fallback usage
- concise selection reason

This is required for trust, debugging, and future policy evaluation.

## Availability + Fallback

The system should never hard fail if a valid fallback exists. If a model is unavailable:
- do not re-grade the task
- do not weaken the capability floor
- choose the next eligible ranked model
- record the fallback reason in telemetry and visible result details

If no fallback exists, return a clear failure explaining the required profile and attempted candidates.

## Learning + Promotion

Telemetry should feed later policy refinement, but runtime remains rule-driven.

### Evidence captured
- success/failure
- retries
- review rejection/rework count
- latency
- token/cost usage
- override usage
- fallback usage

### Promotion modes
- **Auto-promote low-risk updates** when evidence strongly supports them.
- **Require review for major changes** such as changing capability floors or reclassifying models.

This is the designed path from deterministic policy to learned policy without runtime opacity.

## Rollout Strategy

The architecture should support all subagent modes, but rollout should be guarded:
- implement centrally so single, parallel, and chain can all use the selector
- enable first for **single-mode** calls
- expand to **parallel** and **chain** after evaluation proves the policy is stable

A feature flag or policy switch should allow easy rollback to static behavior during rollout.

## Error Handling

The system should handle these cases explicitly:
- **Unknown agent type** → preserve current behavior
- **Missing/malformed policy** → fail safe to existing static/default selection path
- **Unavailable selected model** → deterministic next-eligible fallback
- **No eligible model** → explicit error with required capability profile
- **Override conflicts** → explicit precedence rules and visible resolution
- **Telemetry write failure** → best-effort logging, never block task execution

## Testing Strategy

### Unit tests
- grade suggestion heuristics
- overlay resolution
- capability-floor filtering
- deterministic ranking
- availability fallback
- override precedence
- visibility payload formatting
- telemetry record formatting

### Integration tests
- single-mode dynamic selection happy path
- dynamic selection disabled preserves existing behavior
- unavailable fixed model falls back correctly
- no eligible model returns actionable error
- single-mode rollout guard works while parallel/chain remain unchanged initially

### Eval / benchmark fixtures
- representative implementer/reviewer/worker scenarios across all four grades
- expected eligible set per scenario
- expected preferred model under current policy
- policy comparison output showing cost/capability tradeoffs

## Recommended Additional Goals

In addition to the original goals, the design should explicitly preserve:
- **Explainability** — every choice is inspectable
- **Fallback safety** — capability floor never drops during fallback
- **Provider portability** — avoid hard dependency on one model family
- **Policy stability** — avoid noisy switching between near-equivalent models
- **Evaluation coverage** — all agent types and grades have scenario fixtures
- **Override discipline** — overrides are visible and learnable from telemetry
