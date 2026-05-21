# Contributing to Far Country

The project is not yet open to outside contributors — Phase 0 is a solo, AI-assisted build. This document is written **for the time when it does open up**, so the workflow is clear in advance.

If you are an AI agent working on this repo, also read [`CLAUDE.md`](CLAUDE.md).

---

## 1. Before you start

Read in this order, once:

1. [`README.md`](README.md)
2. [`docs/vision.md`](docs/vision.md)
3. [`docs/hermeneutics.md`](docs/hermeneutics.md) — the interpretive policy is non-negotiable
4. [`docs/prd.md`](docs/prd.md)
5. The ADRs in [`docs/adr/`](docs/adr/)

The hermeneutic policy is the most important document. If you disagree with it strongly, this is probably not the project for you — and that is fine. There are good projects that hold different stances.

---

## 2. Kinds of contributions

| Kind | What it means | What to open |
| --- | --- | --- |
| **Documentation fix** | Typos, broken links, clarifications that don't change meaning | A PR. No issue needed. |
| **Documentation expansion** | New content in the docs that doesn't change the project's stance | An issue first to discuss scope, then a PR. |
| **Descriptor contribution** | Proposing a new descriptor, or proposing a change to an existing one | A PR against the dataset (mechanism TBD in Phase 1.5) including the proposed JSON. The reviewer will treat it as a "pending" entry. |
| **Code change** | Anything touching the pipeline, review UI, app, or 3D layer | An issue first, then a PR. |
| **Architectural change** | Anything that would change an ADR | A new ADR PR that explicitly supersedes the old one. |

---

## 3. Descriptor contribution rules

If you propose a descriptor:

1. It must rest on at least one ESV citation.
2. It must conform to the schema in [`docs/data-model.md`](docs/data-model.md), including a tier and (if symbolic) a `symbolic_referent`.
3. It must not draw on out-of-scope sources for its primary claim.
4. The PR description must include a brief rationale — why this descriptor, why this tier, why this temporal_phase.
5. The reviewer's decision is final; rejected descriptors are not re-submitted without new evidence.

This is a stricter bar than most open-source projects. The reason is the project's central claim — "biblically accurate" — is only meaningful if entries are vetted.

---

## 4. Code style

- **Python:** `ruff` + `black` defaults; type hints required for public APIs.
- **TypeScript:** strict mode on, `eslint` + `prettier` defaults.
- **Commits:** present tense, one-line summary, blank line, body. Reference issue numbers where applicable.
- **PRs:** small and focused. One concern per PR. Tests for any logic that has tests to add.

---

## 5. Theological disagreement

The project's hermeneutic is documented and ADR-locked. Disagreement is welcome — surface it in an issue, frame it precisely, and we can talk. But silently smuggling in a different hermeneutic via descriptor PRs is not welcome; that is exactly what the review process exists to prevent.

If a theological question arises in review that the reviewer cannot resolve from the existing policy, the descriptor moves to `needs-discussion` and the discussion happens in the open.

---

## 6. Code of Conduct

By participating, you agree to abide by the [`Code of Conduct`](CODE_OF_CONDUCT.md). The short version: be respectful, be precise, and remember the project is built around a subject some people hold sacred — treat the material and other contributors accordingly.
