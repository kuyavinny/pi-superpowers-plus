# Universal Goal Template

`pi-superpowers-plus` uses a **universal goal template** to keep workflow execution aligned with user intent.

The template is designed to work across domains:

- software development
- debugging and incident response
- sysadmin / endpoint administration
- help desk / support work
- optimization / benchmark-driven experimentation

The point is not to add paperwork. The point is to make sure the workflow can always answer:

1. What are we trying to achieve?
2. What are we not allowed to break?
3. How will we know we are succeeding?
4. What evidence do we need before claiming success?

## Core Fields

Every goal-aware design or plan should capture these fields.

### Objective
What outcome is wanted.

### Why it matters
Why the user wants it. Business value, operational reason, user pain, or strategic context.

### Constraints
Hard boundaries, safety requirements, forbidden changes, risk limits, or time limits.

### Success signals
Observable signals that indicate progress or success.

### Verification checks
Specific checks that must pass before claiming the goal is satisfied.

### Tradeoffs
What can be sacrificed and what cannot.

### Scope / off-limits
What may be touched and what must remain untouched.

### Artifacts
What records should remain after the work:

- plans
- docs
- logs
- benchmark results
- ticket notes
- commits
- rollback notes

### Execution mode hint
A best-fit workflow lane, such as:

- `standard`
- `debugging`
- `operations`
- `autoresearch`

### Stop conditions
When to stop iterating, escalate, or ask for human guidance.

## Domain Overlays

The universal template is canonical. Domain-specific views are derived from it as **overlays**, not separate systems.

Examples:

- **Coding overlay** — tests, regressions, benchmarks, changed files
- **Sysadmin overlay** — blast radius, rollback plan, service health, observability
- **Help desk overlay** — user impact, reproduction, remediation notes, follow-up actions
- **Autoresearch overlay** — benchmark command, metric direction, checks, experiment scope

The overlay sharpens the goal. It does not replace the core fields.

## Example

```md
## Goal

### Objective
Reduce test runtime for the targeted suite.

### Why it matters
The current test loop is slow enough to reduce iteration speed and discourage local verification.

### Constraints
- No correctness regressions
- No removal of coverage
- No new external dependencies

### Success signals
- Median runtime is lower than baseline
- Developer feedback loop feels faster

### Verification checks
- Targeted test suite passes
- Full relevant checks pass

### Tradeoffs
- Small config complexity increase is acceptable
- Reduced coverage is not acceptable

### Scope / Off-Limits
- In scope: vitest config, test runner setup
- Off-limits: production runtime code

### Artifacts
- design doc
- implementation plan
- benchmark notes
- verification output

### Execution mode hint
autoresearch

### Stop conditions
- Improvement is within noise after repeated attempts
- Correctness checks fail repeatedly
- Changes become too complex for the measured gain
```

## Design Intent

A workflow can be perfectly disciplined and still drift away from the user's real goal.

This template exists to prevent that.
