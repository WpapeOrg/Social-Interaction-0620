---
name: commit-flow-enforcer
description: Enforce safe and reviewable Git delivery flow for feature work. Use when creating or restructuring branch strategy, splitting work into focused commits, preparing push/merge plans, avoiding unrelated staged files, or generating deterministic branch/commit conventions for multi-feature tasks.
---

# Commit Flow Enforcer

## Overview

Plan and execute Git changes with strict separation of concerns.  
Create small, auditable branches and commits that map one-to-one to requirements.

## Workflow

1. Inspect current branch and dirty state with `git branch --show-current` and `git status --short`.
2. Group files by requirement boundary before creating or reusing branches.
3. Create one branch per requirement area, then commit only relevant files.
4. Push each branch with upstream tracking and verify remote branch creation.
5. Merge branches into integration branch (`master` or target branch) in dependency order.

## Branching Rules

- Use `feature/<scope>` naming for requirement branches.
- Keep one requirement per branch; do not mix docs/UI/API in the same commit unless explicitly requested.
- If a new request is a direct iteration of an existing requirement, continue on the original branch instead of creating a new branch.
- Keep integration branch merge commits explicit (`--no-ff`) when traceability matters.

## Commit Rules

- Stage files explicitly; avoid `git add .` on dirty repositories.
- Write imperative, scoped commit messages:
  - `chore: initialize repository structure`
  - `docs: add roadmap and iteration plan`
  - `feat: implement admin moderation APIs`
- Keep commits focused and reviewable; split large commits by component.

## Push and Merge Rules

- Push each feature branch with `git push -u origin <branch>`.
- Confirm remote state before merge using `git branch -r` or push output.
- Merge in dependency order:
  1. repo init
  2. requirements/docs foundation
  3. shared design/base
  4. feature branches
  5. backend/admin
- Push integration branch only after all merges succeed locally.

## Safety Guardrails

- Never rewrite history (`reset --hard`, forced push) unless explicitly requested.
- Never stage unrelated local changes when preparing targeted commits.
- If unexpected modifications appear, stop and request user confirmation before proceeding.
