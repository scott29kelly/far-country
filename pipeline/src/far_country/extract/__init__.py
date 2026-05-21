"""LLM-assisted extraction of candidate descriptors from Scripture and Willis."""

from far_country.extract.dedup import (
    DedupeKey,
    candidate_key,
    citation_key,
    citation_key_from_orm,
    dedupe,
    normalize_statement,
    partition_candidates,
)
from far_country.extract.extractor import (
    DEFAULT_MODEL,
    ExtractionResult,
    Extractor,
    ExtractorError,
    ModelCaller,
    make_anthropic_caller,
)
from far_country.extract.models import (
    CandidateDescriptor,
    CitationCandidate,
    ScriptureCitationCandidate,
    WillisCitationCandidate,
)
from far_country.extract.persist import PersistOutcome, persist_extraction
from far_country.extract.prompts import (
    PROMPT_VERSION,
    render_entity_prompt,
    render_passage_prompt,
    render_willis_prompt,
)

__all__ = [
    "DEFAULT_MODEL",
    "PROMPT_VERSION",
    "CandidateDescriptor",
    "CitationCandidate",
    "DedupeKey",
    "ExtractionResult",
    "Extractor",
    "ExtractorError",
    "ModelCaller",
    "PersistOutcome",
    "ScriptureCitationCandidate",
    "WillisCitationCandidate",
    "candidate_key",
    "citation_key",
    "citation_key_from_orm",
    "dedupe",
    "make_anthropic_caller",
    "normalize_statement",
    "partition_candidates",
    "persist_extraction",
    "render_entity_prompt",
    "render_passage_prompt",
    "render_willis_prompt",
]
