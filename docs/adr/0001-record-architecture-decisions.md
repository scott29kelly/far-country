# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

Far Country is a long-lived, ambitious, solo + AI-assisted project. Significant architectural and interpretive decisions will be made over time, often months apart. Without a written record, the rationale behind earlier choices is lost — leading to drift, contradictory choices, or wasted effort re-litigating settled matters.

## Decision

We will record architecturally significant decisions as Architecture Decision Records (ADRs), one decision per file, in `docs/adr/`. We use the Michael Nygard format: Context, Decision, Status, Consequences. ADRs are immutable once accepted — to change a decision, write a new ADR that supersedes the old one.

ADRs are numbered sequentially (0001, 0002, ...) and named kebab-case after the decision (e.g., `0002-tech-stack.md`).

## What counts as "architecturally significant"

- Choice of language, framework, datastore, or major library.
- Choice of source corpus or interpretive policy.
- Choice of data model shape, when changing it would force consumers to migrate.
- Choice of distribution or licensing posture.
- Choice of LLM grounding strategy.

Day-to-day code style, dependency bumps, and small refactors do not need an ADR.

## Consequences

- Every significant decision has a written rationale that can be re-read months later.
- Reversing a decision requires writing a new ADR — this is a feature, not a bug. It forces deliberate change.
- Onboarding (including AI-assisted sessions) is faster: read the ADRs, know the shape of the project.

## References

- Michael Nygard, "Documenting Architecture Decisions" (2011): https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
