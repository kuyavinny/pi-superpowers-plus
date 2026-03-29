# Dynamic Subagent Model Selection

`pi-superpowers-plus` can now choose subagent models dynamically for bundled agent types.

## What it does

When dynamic selection is enabled for **single-mode** `subagent` calls, the extension:

1. suggests a task grade (`light`, `standard`, `heavy`, `deep`)
2. applies any optional grade override
3. resolves the bundled agent type's required capability floor
4. selects the lowest-cost eligible available model
5. falls back to the next eligible model if the chosen model is unavailable
6. records telemetry for later policy refinement

The selector is deterministic and explainable. Capability floor comes first; cost optimization happens only among eligible models.

## Rollout status

Dynamic selection is currently guarded behind:

```bash
PI_SUBAGENT_DYNAMIC_MODEL_SELECTION=1
```

Current rollout:
- **Enabled:** single-mode `subagent({ agent, task, ... })`
- **Not yet enabled:** parallel and chain execution paths

If the flag is not set, bundled agents use their static/default model behavior.

## Overrides

### Grade override

```ts
subagent({
  agent: "implementer",
  task: "Implement retry handling in src/auth.ts",
  grade: "standard",
})
```

### Model override

```ts
subagent({
  agent: "code-reviewer",
  task: "Review the auth feature",
  model: "openai-codex/gpt-5-mini",
})
```

If `model` is provided, that explicit override wins. Prefer provider-qualified IDs. Bare built-in IDs are normalized before launch so `gemini-2.5-flash` becomes `google-gemini-cli/gemini-2.5-flash`; other bare ids fail clearly instead of relying on provider inference.

## Selection visibility

Single-mode results expose a `selection` summary including:
- agent type
- suggested grade
- final grade
- selected model
- whether override was used
- fallback reason
- concise selection reason

## Telemetry

Best-effort telemetry is written locally to:

```text
.pi/subagent/telemetry.jsonl
```

Each record includes:
- suggested and final grade
- selected model
- fallback and override usage
- success/failure
- latency
- usage stats

Telemetry never blocks subagent execution.

## Policy evaluation

A lightweight eval script is included for autoresearch tuning:

```bash
# Use whichever runtime is available in your environment
node scripts/subagent-policy-eval.mjs
# or
bun scripts/subagent-policy-eval.mjs
```

The eval reports:
- weighted cost score
- floor violations
- fallback count
- per-scenario selected model

## Promotion model

Policy refinement follows a hybrid promotion model:
- low-risk reorderings within the same capability band may auto-promote
- threshold changes and model reclassification require review

## Notes

- Bundled agents no longer hard-pin a single model in frontmatter.
- Bundled policy-selected models are stored as provider-qualified IDs.
- Dynamic selection currently targets the bundled agent names:
  - `implementer`
  - `worker`
  - `code-reviewer`
  - `spec-reviewer`
- Custom project/user agents can still set explicit `model:` values if desired.
