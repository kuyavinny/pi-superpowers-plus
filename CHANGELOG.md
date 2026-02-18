# Changelog

All notable changes to pi-superpowers-plus are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0-alpha.1] — 2026-02-18

### Security

- **Environment variable filtering** — subagent spawn now uses an allowlist instead of `{ ...process.env }`. Only safe vars (PATH, HOME, SHELL, NODE_*, PI_*, etc.) are forwarded. Secrets like API keys, database URLs, and cloud credentials are no longer leaked to subagent processes.
- **`PI_SUBAGENT_ENV_PASSTHROUGH`** — escape hatch for users who need to forward specific vars (comma-separated names).
- **CWD validation** — subagent spawn now validates the working directory exists before spawning, returning a clear error instead of a cryptic ENOENT.

### Added

- **Configurable subagent timeout** (`PI_SUBAGENT_TIMEOUT_MS`, default 10 min) — absolute timeout that kills subagents regardless of activity. Agent definitions can override via `timeout` field.
- **Cancellation propagation** — active subagent processes are tracked and killed (SIGTERM → SIGKILL) when the parent session exits.
- **Concurrent subagent cap** (`PI_SUBAGENT_CONCURRENCY`, default 6) — semaphore-based limit on parallel subagent spawns. When the cap is hit, new invocations queue until a slot opens.

### Fixed

- Silent catch blocks in workflow-monitor now log warnings via `log.warn` instead of silently swallowing failures (state file read/write errors).

---

## [0.2.0-alpha.1] — 2026-02-13

### Summary

First-class subagent support. Skills now dispatch implementation and review work via a bundled `subagent` tool instead of shell commands. Four default agent definitions ship with the package. The workflow monitor and TDD enforcement both received important correctness fixes.

### Added

- **Subagent extension** (`extensions/subagent/`) — vendored from pi's example extension. Registers a `subagent` tool that spawns isolated pi subprocesses for implementation and review tasks. Supports single-agent and parallel (multi-task) modes.
- **Agent definitions** (`agents/`) — four bundled agent profiles:
  - `implementer` — strict TDD implementation with the tdd-guard extension
  - `worker` — general-purpose task execution
  - `code-reviewer` — production readiness review (read-only)
  - `spec-reviewer` — plan/spec compliance verification (read-only)
- **Agent frontmatter `extensions` field** — agent `.md` files can declare extensions (e.g. `extensions: ../extensions/tdd-guard.ts`), which are resolved and passed as `--extension` flags to the subprocess.
- **TDD guard extension** (`extensions/tdd-guard.ts`) — lightweight TDD enforcement designed for subagents. Blocks production file writes until a passing test run is observed. Tracks violations via `PI_TDD_GUARD_VIOLATIONS_FILE` env var. Exits after 3 consecutive blocked writes.
- **Structured subagent results** — single-agent mode returns `filesChanged`, `testsRan`, `tddViolations`, `agent`, `task`, and `status` fields in tool result details.
- **Shared test helpers** (`tests/extension/workflow-monitor/test-helpers.ts`) — `createFakePi()`, `getSingleHandler()`, `getHandlers()` extracted and shared across all workflow-monitor test files.
- **`parseSkillName()` utility** (`extensions/workflow-monitor/workflow-tracker.ts`) — centralized `/skill:name` and `<skill name="...">` extraction, replacing duplicated regexes.

### Fixed

- **Input event text field** — Workflow monitor now reads `event.text` (primary) with fallback to `event.input` for skill detection in user input. Previously only checked `event.input`, missing skills delivered via the `text` field.
- **Completion gate phase scoping** — Interactive commit/push/PR prompts now only fire during execute+ phases. Previously they could fire during brainstorm/plan, interrupting early-phase work (e.g. committing a design doc).
- **docs/plans allowlist path traversal** — The brainstorm/plan write allowlist now resolves paths against `process.cwd()` and requires the resolved path to be under `${cwd}/docs/plans/`. Previously, an absolute path like `/tmp/evil/docs/plans/attack.ts` would pass the substring check.
- **TDD guard pass/fail semantics** — The tdd-guard extension now requires a *passing* test result (exit code 0) to unlock production writes. Previously, any test command execution — including failures — would unlock writes.

### Changed

- **Skills updated for subagent dispatch** — `subagent-driven-development`, `dispatching-parallel-agents`, and `requesting-code-review` skills now show `subagent()` tool call examples instead of `pi -p` shell commands.
- **Package version** bumped to `0.2.0-alpha.1`.
- **`package.json` `files`** now includes `agents/` directory.
- **`package.json` `pi.extensions`** now includes `extensions/subagent/index.ts`.

### Internal

- Deduplicated ~180 lines of test helper boilerplate across 6 workflow-monitor test files.
- Added 8 new test files (67 new tests) covering subagent discovery, frontmatter extensions, structured results, tdd-guard behavior, completion gate phasing, path traversal, and input event handling.
- Total test count: **29 files, 251 tests**.

---

## [0.1.0-alpha.3] — 2026-02-12

### Summary

Warning escalation guardrails, branch safety, workflow tracking with phase boundaries, and the initial release of active enforcement extensions.

### Added

- Workflow Monitor extension with TDD, debug, and verification enforcement
- Plan Tracker extension with TUI widget
- 12 workflow skills ported and trimmed from pi-superpowers
- Branch safety notices (current branch on first tool result, confirm-branch on first write)
- Workflow phase tracking with boundary prompts and `/workflow-next` command
- Warning escalation: soft → hard block → user override
- `workflow_reference` tool for on-demand TDD/debug reference content

---

## [0.1.0-alpha.1] — 2026-02-10

Initial alpha release. Skills only, no extensions.
