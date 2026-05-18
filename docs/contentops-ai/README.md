# ContentOps AI

AI-assisted content operations subsystem for Little Smiles — SEO blog generation, editorial review workflow, scheduled publishing, and image orchestration.

## Status

**Pre-implementation.** Architectural decisions are locked. No code has shipped yet. Phase 1 scope is being defined.

## What this folder is

Three documents, not ten. Add more only when one becomes too long to scan in a single read.

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — locked decisions, system shape, non-goals, decision-change process.
- **[ROADMAP.md](ROADMAP.md)** — current focus, phased delivery, inline decisions log.

## Source-of-truth rules

- Repo wins over chat. If a decision isn't written down here, it isn't decided.
- One decision → one place. Cross-reference, don't duplicate.
- Updates ship in the **same commit** as the change they describe — never "later."
- The root-level `AI_CONTEXT.md` is the storefront-wide AI onboarding. This folder covers only the ContentOps subsystem — don't restate root-level facts here.

## For future AI sessions

Read in this order before suggesting or writing ContentOps code:

1. Root [`AI_CONTEXT.md`](../../AI_CONTEXT.md) — storefront architecture and constraints.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — subsystem decisions.
3. [`ROADMAP.md`](ROADMAP.md) — current focus and decisions log.

If a request would contradict `ARCHITECTURE.md`, surface the conflict before acting. Decisions can be overturned, but never silently.
