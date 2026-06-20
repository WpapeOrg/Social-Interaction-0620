---
name: markdown-docs-optimizer
description: Refactor project Markdown documentation into a maintainable structure with canonical ownership. Use when updating README, splitting large docs into docs/*.md, adding API/deployment/database docs, reducing duplicated content, adding changelog entries, or documenting implemented and roadmap features.
---

# Markdown Docs Optimizer

## Overview

Keep documentation modular, link-first, and durable as the codebase evolves.  
Use README as the entry point and move detailed content into dedicated docs.

## Workflow

1. List markdown files with `rg --files -g '*.md'`.
2. Scan heading structure with `rg -n '^#|^##|^###' README.md docs/*.md CHANGELOG.md`.
3. Assign canonical topic owners before adding text.
4. Move long sections to dedicated docs and replace README content with links.
5. Add or update `CHANGELOG.md` for visible documentation restructuring.
6. Validate links and heading consistency before finishing.

## Canonical Ownership

- README: project intro, quick start, docs index.
- `docs/API.md`: endpoints, auth, payloads, errors.
- `docs/DATABASE.md`: schema, migrations, DB operations.
- `docs/ENV_SETUP.md`: local run and dependency setup.
- `docs/IMPLEMENTED_FEATURES.md`: implemented, not-implemented, next features.
- `docs/ROADMAP.md`: phased product direction and release priorities.
- `CHANGELOG.md`: documentation and product-visible changes.

## README Rules

- Keep README short and decision-oriented.
- Link to canonical docs instead of duplicating long instructions.
- Include implemented summary plus links to roadmap and execution plan.

## Quality Rules

- Keep one canonical source per topic.
- Use relative links only.
- Use placeholders for user-specific values (`<your-token>`, `<your-domain>`).
- Avoid secrets, passwords, private keys, or raw tokens in docs.

## Validation Checklist

- Run headings check: `rg -n '^#|^##|^###' README.md docs/*.md CHANGELOG.md`.
- Run link existence check for relative markdown links.
- Run secret scan for obvious token/private-key patterns.
- Review `git diff --stat` and ensure only documentation files changed.
