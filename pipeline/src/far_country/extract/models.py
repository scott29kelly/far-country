"""Pydantic models for the candidate descriptors produced by extraction.

The LLM returns a JSON array of `CandidateDescriptor` objects. Validation
mirrors the canonical schema (`docs/data-model.md`) so any candidate that
parses here can be inserted into the `descriptor` and `citation` tables
with no further coercion.
"""

from __future__ import annotations

from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

EntityType = Literal["person", "place", "thing", "event", "attribute"]
Tier = Literal["clear", "fuzzy", "debated", "symbolic"]
TemporalPhase = Literal["intermediate", "final", "either", "unspecified"]


class ScriptureCitationCandidate(BaseModel):
    source_type: Literal["scripture"] = "scripture"
    book: str
    chapter: int
    verse_start: int
    verse_end: int | None = None


class WillisCitationCandidate(BaseModel):
    source_type: Literal["willis"] = "willis"
    willis_chapter: str
    willis_page_start: int
    willis_page_end: int | None = None


CitationCandidate = Annotated[
    ScriptureCitationCandidate | WillisCitationCandidate,
    Field(discriminator="source_type"),
]


class CandidateDescriptor(BaseModel):
    """One extracted candidate, ready for human review.

    `entity_*_suggestion` fields are LLM-proposed; the reviewer may accept,
    reassign to an existing entity, or rename. `symbolic_referent` is
    required when `tier == 'symbolic'` (see docs/data-model.md §3).
    """

    statement: str
    entity_id_suggestion: str = Field(description="Proposed entity slug, e.g. 'new-jerusalem'.")
    entity_name_suggestion: str
    entity_type_suggestion: EntityType
    tier: Tier
    symbolic_referent: str | None = None
    temporal_phase: TemporalPhase
    citations: list[CitationCandidate] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_symbolic_referent(self) -> Self:
        if self.tier == "symbolic" and not self.symbolic_referent:
            raise ValueError(
                "symbolic_referent is required when tier='symbolic' (see docs/data-model.md §3)"
            )
        return self
