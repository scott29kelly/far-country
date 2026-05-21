# ADR 0005 — Hermeneutic policy

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

"Biblically accurate" is the project's central claim. Without a codified interpretive stance, that phrase is unfalsifiable. Different traditions read the same passages differently — apocalyptic imagery, the millennium, the intermediate vs final state, the role of symbolism — and an uncodified project would drift between readings without notice.

## Decision

Far Country adopts a **conservative Protestant, literal-where-possible** hermeneutic. The full policy is in [`docs/hermeneutics.md`](../hermeneutics.md). The key points, ADR-locked:

1. **Scripture is the highest authority.** Tradition, councils, and respected interpreters are weighed below Scripture.
2. **The ESV is the canonical translation.** No other translation is used as a primary source for descriptors.
3. **The 66 books of the Protestant canon are the only canonical source.** Apocrypha and Pseudepigrapha are out of scope as primary sources.
4. **Literal-where-possible.** Plain statements are read plainly unless the text itself signals symbolism.
5. **Symbolism is signaled by genre, framing, stated symbolism, internal absurdity, or numerical patterns.** When signaled, descriptors are tier-tagged `symbolic` and must include a `symbolic_referent`.
6. **Fuzzy and debated material is preserved, not discarded.** Both enter the canonical dataset with appropriate tier tags.
7. **Janet Willis is the primary structuring lens** but is not Scripture. Willis-only claims enter the dataset only as `fuzzy` or `debated` candidates for human review.

## Consequences

- The project will not satisfy readers operating from other hermeneutics (Catholic, Orthodox, liberal Protestant). This is accepted. Different hermeneutics could produce different versions of the project from the same pipeline; that is a future possibility, not a current goal.
- The reviewer's job has a clear standard: descriptors are approved when they conform to this hermeneutic.
- The Q&A interface inherits this hermeneutic by virtue of being grounded in descriptors that pass it.
- Changes to the hermeneutic — broader source set, different translation, different interpretive stance — require a new ADR superseding this one, and may force re-tiering of existing descriptors (a separate migration ADR).

## References

- [`docs/hermeneutics.md`](../hermeneutics.md)
- [`docs/sources.md`](../sources.md)
