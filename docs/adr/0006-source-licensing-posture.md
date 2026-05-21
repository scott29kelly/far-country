# ADR 0006 — Source licensing posture

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

Two of the project's primary sources are copyrighted:

- **The ESV Bible** (© 2001 Crossway). Use is governed by Crossway's permissions policy; programmatic access via the ESV API has its own terms.
- **Janet Willis, *What on Earth Is Heaven Like? A Look at God's City New Jerusalem***. Standard book copyright applies; permission would be required for any redistribution of excerpts or derivative summaries.

We must decide how to handle these sources during development and what it would take to ship publicly.

## Decision

**Posture during current development: personal-study use.**

- ESV text is fetched from the ESV API at extraction time. Local caching is for development efficiency only. Text is not committed to the repo.
- Willis text is held locally in `data/raw/willis/` (not committed). Excerpts inform extraction; verbatim text is not exposed to consumers.
- The canonical dataset stores **descriptors** (paraphrased, project-original claims) and **citations** (book/chapter/verse for ESV; chapter/page for Willis). Descriptors are derivative summaries by design; they do not reproduce source text.
- This posture is appropriate for personal study and limited development sharing. **It is not sufficient for public distribution.**

**Prerequisites for public distribution:**

1. **ESV.** Either:
   - Obtain ESV API permissions for the intended use, fetching text at runtime client-side; or
   - Negotiate broader permissions with Crossway for any in-repo or in-app static text; or
   - Switch to a public-domain translation (KJV) for any text-display path, which would itself require an ADR superseding [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md).
2. **Willis.** Obtain explicit permission from the rights holder for the form of derivation Far Country uses (citation lists, paraphrased descriptors organized around her chapters). If permission is not granted, restructure to depend on Willis only via Scripture references she points to, with no Willis-only citations.
3. **Legal review** of the descriptor model — confirming that the descriptor + citation pattern is defensibly derivative and not a substantial reproduction.

## What this means in practice

- During Phase 1 and Phase 2, we operate freely under the personal-study posture.
- Before any public soft launch, we open a new ADR to record the licensing path actually taken.
- The codebase is structured so that the ESV runtime fetch and the Willis-citation surface are isolated — they can be re-wired (or gated behind permission) without touching the dataset.

## Consequences

- We do not have to wait for permissions to make progress on the dataset and the experience.
- We do have to defer public distribution until the licensing path is resolved.
- The `LICENSE` file at the repo root reflects this: TBD on code license, restricted-use note on content.
- Contributors (when the project opens up) are bound by the same posture.

## References

- [`LICENSE`](../../LICENSE)
- [`docs/sources.md`](../sources.md)
- ESV API: https://api.esv.org/
