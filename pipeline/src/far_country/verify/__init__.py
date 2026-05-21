"""Citation verification: does the cited source text actually support the claim?

Two layers (per `docs/specs/phase-1-dataset.md` §3.3):

- `keyword_overlap_score` — cheap, deterministic content-word overlap between
  the descriptor statement and the cited text. Used as the primary signal.
- An optional LLM-judge protocol (`JudgeCaller`) — same shape as the
  extractor's `ModelCaller`, kept off the import path of the SDK so this
  module loads without `anthropic` installed.
"""

from far_country.verify.citation_check import (
    DEFAULT_PARTIAL_THRESHOLD,
    DEFAULT_PASS_THRESHOLD,
    CitationFetcher,
    JudgeCaller,
    JudgeError,
    VerificationResult,
    VerificationStatus,
    classify_score,
    content_tokens,
    keyword_overlap_score,
    verify_citation,
    verify_descriptor,
)

__all__ = [
    "DEFAULT_PARTIAL_THRESHOLD",
    "DEFAULT_PASS_THRESHOLD",
    "CitationFetcher",
    "JudgeCaller",
    "JudgeError",
    "VerificationResult",
    "VerificationStatus",
    "classify_score",
    "content_tokens",
    "keyword_overlap_score",
    "verify_citation",
    "verify_descriptor",
]
