# GitHub Fork + Local History Sync Design

## Goal

### Objective
Create a fork of `coctostan/pi-superpowers-plus` under the authenticated GitHub account and publish the current local work into that fork without losing or reshaping commit history.

### Why it matters
The repo currently tracks upstream in `origin`, but the user wants their own GitHub-owned copy that includes all local work. That gives them ownership, a safe place to continue development, and a stable remote for future pushes and collaboration.

### Constraints
- Must use the authenticated `gh` account already available in this session.
- Must preserve existing commit history, including merge commits and merged feature branches.
- Must not drop or rewrite local commits just to simplify the fork.
- Must account for the fact that `origin` currently points to upstream, not to a personal fork.
- Must avoid breaking existing local worktrees or branch tracking unless explicitly intended.
- Must be run from a clean tree or an isolated worktree. For this specific session, that means the planning document itself must be committed first or the fork workflow must be executed from a separate clean checkout.
- Current repo state is clean, but there is local history ahead of `origin/main`.

### Success signals
- A fork exists in the user’s GitHub account.
- The fork contains the current `main` branch history from this repo.
- Any local-only branches with unique work are either pushed intentionally or confirmed merged and therefore unnecessary to publish separately.
- Local remotes are arranged so the fork is easy to use without confusing upstream tracking.

### Verification checks
- `git status` shows a clean tree before publishing.
- `git branch --merged main` and `git branch --no-merged main` confirm whether any local work needs extra branch refs.
- `git reflog --all` is checked for detached, deleted, or otherwise hidden local commits if the branch audit is inconclusive.
- `gh repo view <owner>/<repo>` or `gh api repos/<owner>/<repo>` confirms the fork exists under the user account.
- `git ls-remote` against the fork confirms the expected refs are present.
- `git config --get-regexp '^(remote|branch\\.)'` verifies the intended remote/branch tracking layout.

### Scope / Off-limits
- In scope: fork creation, remote setup, branch/ref push, and post-push verification.
- Out of scope: changing repository code, rebasing history, or cleaning unrelated local work unless required for a safe push.

### Execution mode hint
shell-first, low-risk git operations with verification after each step.

### Stop conditions
- If any uncommitted local changes appear, stop and resolve them before forking.
- If local branches contain unmerged unique commits, stop and decide whether they should also be published.
- If `gh` cannot create or access the fork reliably, stop and inspect account/repo naming before proceeding.
- If the destination fork already contains diverged history, stop and compare refs instead of force-pushing.

## Recommended Approach

Use a conservative remote layout:
- keep `origin` as the upstream repository
- add a new remote for the user-owned fork, e.g. `fork`
- create the fork in a way that does **not** auto-rename `origin`
- push `main` first
- push any additional local-only branches only if they contain unique work not already merged into `main`
- never force-push unless a later explicit decision changes that rule

This preserves the existing upstream relationship and avoids disrupting current branch/worktree assumptions. It is safer than renaming `origin` because this repo already has local worktrees and branch tracking established. After setup, `remote.pushDefault=fork` should be used so accidental plain pushes target the fork while `origin/main` stays available for upstream comparison.

## Workflow

### 1. Audit local refs and branch state
Confirm the tree is clean and identify whether any local branches still contain unique commits. Use the merged/no-merged branch lists and a short log of recent history to verify that the visible feature work is already represented in `main`.

### 2. Create the fork on GitHub
Create the fork under the authenticated account without allowing the command to rewrite the local remote layout. Prefer creation-only flow, then wire the remote manually from the existing checkout. The current local checkout already contains the intended history and should remain the source of truth for the push.

### 3. Add or update the fork remote
Attach the new GitHub fork as a separate remote, ideally named `fork`. Keep the upstream remote intact so the repo can still compare against `coctostan/pi-superpowers-plus`, verify that `origin` still points to upstream after the remote is added, and set `remote.pushDefault=fork` so default pushes land on the user-owned fork.

### 4. Push the intended refs
Push `main` to the fork first. If the audit reveals any extra local-only branches with unique commits, push those refs explicitly. If all such work is already merged into `main`, no extra branch push is needed.

### 5. Verify the fork
Check GitHub-side refs to ensure the fork has the expected commit graph and branch list. Confirm that the fork contains the merged subagent and goal-aware history without duplicate or dangling topic branches unless they were intentionally published. Verify the final remote layout locally as part of the check.

## Error Handling

- **Uncommitted changes detected:** stop and do not create or push the fork until the tree is clean.
- **Branch mismatch:** if a branch appears local-only but is already merged into `main`, do not push it separately; `main` is the authoritative history.
- **Remote naming conflict:** if `fork` already exists, inspect it before overwriting; prefer updating remotes over destructive replacement.
- **Fork creation failure:** if `gh` fails because the repo already exists or account permissions are unclear, verify the target owner and repo name before retrying.
- **Diverged fork history:** if the fork already has commits that are not a fast-forward from local `main`, stop and compare refs; do not force-push by default.

## Validation Plan

1. Ensure the active checkout is clean, or switch to a separate clean checkout/worktree first.
2. Confirm local-only branches are either merged or intentionally retained.
3. Check for hidden local work in reflog/unreachable objects if the branch audit is insufficient.
4. Create fork under the authenticated account without changing the upstream remote layout.
5. Add the fork remote and configure default push behavior to target the fork.
6. Push `main` and any required extra refs.
7. Verify fork visibility, remote layout, and refs on GitHub.
8. Record the final remote layout for future reference.

## Summary

The safest path is to treat the current checked-out repository as the canonical source of truth, create a user-owned GitHub fork, and publish the current `main` history into that fork while keeping the upstream remote untouched. That preserves all merged work, avoids disturbing existing worktrees, and gives the user a clean GitHub home for future development.