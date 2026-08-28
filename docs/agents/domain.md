# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## This repo

Layout: **single-context**.

Existing production ADRs live at `prds/11-decisions/` (index: `prds/11-decisions/00-adr-index.md`). Product glossary and frozen semantics live in `prds/00–11/`. Skills should read those when they exist.

The `CONTEXT.md` + `docs/adr/` layout below is what `/domain-modeling` creates lazily. Do not create those files just because they are missing.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.
- **This repo:** also read `prds/11-decisions/` and the relevant files under `prds/00–11/`.

If `CONTEXT.md` / `CONTEXT-MAP.md` / `docs/adr/` don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context layout is documented by the skill templates but **not used** in this repo.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

**This repo:** if `CONTEXT.md` is absent, use `prds/00-product/03-glossary.md` and the rest of `prds/00–11/`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

**This repo:** also treat `prds/11-decisions/` as ADRs for this check.
