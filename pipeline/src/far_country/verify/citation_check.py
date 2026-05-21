"""Citation verification — keyword/lemma overlap + optional LLM judge.

Given a descriptor statement and the text of its citation, produce a
`VerificationResult` with:

- `score`: fraction of content (non-stopword) tokens from the statement
  that appear in the source text, computed on lightly stemmed forms so
  "walls" matches "wall" and "descending" matches "descend".
- `status`: `pass | partial | fail`, derived from `score` against two
  thresholds. Caller can override defaults; see `classify_score`.
- An optional `judge_status` / `judge_rationale` populated when a
  `JudgeCaller` is supplied. The judge can disagree with the heuristic;
  we keep both signals and let the human reviewer adjudicate.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final, Literal, Protocol

if TYPE_CHECKING:
    from far_country.store.models import Citation, Descriptor

VerificationStatus = Literal["pass", "partial", "fail"]

DEFAULT_PASS_THRESHOLD: Final = 0.6
DEFAULT_PARTIAL_THRESHOLD: Final = 0.3

# A small, deliberately conservative English stoplist. Keeping it short
# avoids accidentally filtering out theologically loaded words ("God",
# "is", "no"). Tune empirically as the dataset grows.
_STOPWORDS: frozenset[str] = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "but",
        "by",
        "for",
        "from",
        "has",
        "have",
        "he",
        "her",
        "him",
        "his",
        "i",
        "in",
        "is",
        "it",
        "its",
        "of",
        "on",
        "or",
        "she",
        "so",
        "that",
        "the",
        "their",
        "them",
        "they",
        "this",
        "to",
        "was",
        "we",
        "were",
        "which",
        "will",
        "with",
        "you",
        "your",
    }
)

_TOKEN = re.compile(r"[\w']+", flags=re.UNICODE)
_VERSE_MARKER = re.compile(r"\[\d+\]")


class JudgeError(RuntimeError):
    """Raised when the LLM judge returns a response we can't parse."""


JudgeCaller = Callable[[str, str], tuple[VerificationStatus, str]]
"""Callable: `(statement, source_text) -> (status, rationale)`.

The judge owns its own LLM client. Verification stays SDK-agnostic so
this module imports cleanly without `anthropic` installed.
"""


class CitationFetcher(Protocol):
    """Resolves a stored `Citation` row to its source text.

    Implementations wrap an `ESVClient` for scripture and a Willis loader
    for Willis citations. The verifier doesn't care which.
    """

    def fetch(self, citation: Citation) -> str:
        """Return the plain text the citation points to. Raise if unresolvable."""


@dataclass(frozen=True)
class VerificationResult:
    descriptor_id: str | None
    citation_id: str | None
    score: float
    status: VerificationStatus
    rationale: str
    judge_status: VerificationStatus | None = None
    judge_rationale: str | None = None

    def to_json(self) -> str:
        payload = {
            "descriptor_id": self.descriptor_id,
            "citation_id": self.citation_id,
            "score": round(self.score, 4),
            "status": self.status,
            "rationale": self.rationale,
            "judge_status": self.judge_status,
            "judge_rationale": self.judge_rationale,
        }
        return json.dumps(payload, sort_keys=True)


def _stem(token: str) -> str:
    """Very light stemming: drop trailing inflections so morphological
    variants collide. Not a real lemmatizer — we deliberately avoid the
    NLTK/spaCy dependency for this heuristic."""
    t = token
    for suffix in ("ing", "ed", "es", "s"):
        if len(t) > len(suffix) + 2 and t.endswith(suffix):
            return t[: -len(suffix)]
    return t


def content_tokens(text: str, *, stopwords: frozenset[str] | None = None) -> list[str]:
    """Return the lowercased, lightly-stemmed content tokens of `text`.

    Drops stopwords and ESV-style verse markers like `[2]`. Strips
    apostrophes ("god's" → "gods") so possessives match their roots.
    """
    if stopwords is None:
        stopwords = _STOPWORDS
    cleaned = _VERSE_MARKER.sub(" ", text)
    cleaned = unicodedata.normalize("NFKC", cleaned).lower()
    cleaned = cleaned.replace("'", "")
    tokens: list[str] = []
    for raw in _TOKEN.findall(cleaned):
        if raw in stopwords:
            continue
        if raw.isdigit():
            continue
        tokens.append(_stem(raw))
    return tokens


def keyword_overlap_score(
    statement: str,
    source_text: str,
    *,
    stopwords: frozenset[str] | None = None,
) -> float:
    """Fraction of content tokens from `statement` that appear in `source_text`.

    Returns `0.0` if the statement has no content tokens (degenerate case;
    surfaces as `fail` via `classify_score`).
    """
    statement_tokens = content_tokens(statement, stopwords=stopwords)
    if not statement_tokens:
        return 0.0
    source_set = set(content_tokens(source_text, stopwords=stopwords))
    matches = sum(1 for tok in statement_tokens if tok in source_set)
    return matches / len(statement_tokens)


def classify_score(
    score: float,
    *,
    pass_threshold: float = DEFAULT_PASS_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_THRESHOLD,
) -> VerificationStatus:
    """Map a 0..1 overlap score to a verification status."""
    if score >= pass_threshold:
        return "pass"
    if score >= partial_threshold:
        return "partial"
    return "fail"


def verify_citation(
    statement: str,
    source_text: str,
    *,
    descriptor_id: str | None = None,
    citation_id: str | None = None,
    judge: JudgeCaller | None = None,
    pass_threshold: float = DEFAULT_PASS_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_THRESHOLD,
) -> VerificationResult:
    """Run the keyword-overlap heuristic, optionally augmented by an LLM judge."""
    score = keyword_overlap_score(statement, source_text)
    status = classify_score(
        score, pass_threshold=pass_threshold, partial_threshold=partial_threshold
    )
    rationale = (
        f"keyword overlap {score:.2f} "
        f"(pass>={pass_threshold:.2f}, partial>={partial_threshold:.2f})"
    )

    judge_status: VerificationStatus | None = None
    judge_rationale: str | None = None
    if judge is not None:
        judge_status, judge_rationale = _run_judge(judge, statement, source_text)

    return VerificationResult(
        descriptor_id=descriptor_id,
        citation_id=citation_id,
        score=score,
        status=status,
        rationale=rationale,
        judge_status=judge_status,
        judge_rationale=judge_rationale,
    )


def verify_descriptor(
    descriptor: Descriptor,
    *,
    fetcher: CitationFetcher,
    judge: JudgeCaller | None = None,
    pass_threshold: float = DEFAULT_PASS_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_THRESHOLD,
) -> list[VerificationResult]:
    """Verify every citation on a stored descriptor against its source text.

    Skips secondary citations (they support, but cannot ground, a claim).
    A descriptor with no resolvable citations returns an empty list.
    """
    results: list[VerificationResult] = []
    for citation in descriptor.citations:
        if citation.source_type == "secondary":
            continue
        source_text = fetcher.fetch(citation)
        results.append(
            verify_citation(
                descriptor.statement,
                source_text,
                descriptor_id=descriptor.id,
                citation_id=citation.id,
                judge=judge,
                pass_threshold=pass_threshold,
                partial_threshold=partial_threshold,
            )
        )
    return results


_VALID_JUDGE_STATUSES: frozenset[str] = frozenset({"pass", "partial", "fail"})


def _run_judge(
    judge: JudgeCaller, statement: str, source_text: str
) -> tuple[VerificationStatus, str]:
    status, rationale = judge(statement, source_text)
    if status not in _VALID_JUDGE_STATUSES:
        raise JudgeError(f"Judge returned invalid status {status!r}; expected pass|partial|fail")
    return status, rationale
