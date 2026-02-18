# Security Audit — Subagent Env Filtering & CWD Validation

**Date:** 2026-02-18
**Status:** Approved
**Scope:** v0.3.0 roadmap item — Security Audit

## Problem

Subagent spawn passes `{ ...process.env }` to child processes, leaking all environment variables including secrets (API keys, database URLs, cloud credentials). Project-local agents from untrusted repos inherit everything in the parent shell.

## Design

### 1. Environment Variable Filtering

Replace `{ ...process.env }` with a prefix-based allowlist plus an explicit set of known-safe variables.

**Allowlist prefixes:**
- `PI_` — pi-specific config
- `NODE_` — Node.js runtime
- `NPM_` — npm config
- `NVM_` — nvm config
- `LANG` — locale (matches `LANG` and `LANGUAGE`)
- `LC_` — locale categories
- `XDG_` — XDG base dirs

**Explicit vars:**
`PATH`, `HOME`, `SHELL`, `TERM`, `USER`, `LOGNAME`, `TMPDIR`, `EDITOR`, `VISUAL`, `SSH_AUTH_SOCK`, `COLORTERM`, `FORCE_COLOR`, `NO_COLOR`

**Escape hatch:**
`PI_SUBAGENT_ENV_PASSTHROUGH` — comma-separated variable names to forward. Read from the parent `process.env` before filtering.

**Implementation:**
- New function `buildSubagentEnv()` in `extensions/subagent/index.ts` (or a small util)
- Iterates `Object.entries(process.env)`, keeps entries matching prefixes or explicit set
- Merges passthrough vars
- Adds `PI_TDD_GUARD_VIOLATIONS_FILE` (already done per-invocation)

### 2. CWD Existence Check

Before spawn, resolve the cwd path and verify the directory exists. If not, fail with a clear error message instead of a cryptic `ENOENT` from spawn.

```typescript
const resolved = path.resolve(cwd);
if (!fs.existsSync(resolved)) {
  throw new Error(`Subagent cwd does not exist: ${resolved}`);
}
```

No path restrictions — subagents have the same permissions as pi and can `cd` anywhere via bash regardless.

### 3. Spawn Args

No changes needed. `shell: false` prevents shell injection. Task strings are prefixed with `Task: ` so they can't be parsed as flags. Already solid.

## Testing

- Env filter includes PATH, HOME, PI_* vars
- Env filter excludes common secrets (AWS_SECRET_ACCESS_KEY, DATABASE_URL)
- Passthrough override works (PI_SUBAGENT_ENV_PASSTHROUGH=MY_VAR forwards MY_VAR)
- CWD validation rejects nonexistent directories with clear error
- Existing subagent integration tests still pass

## Scope

- ~30 lines for env filtering function
- ~5 lines for cwd validation
- ~50 lines of tests
- Touches: `extensions/subagent/index.ts`
