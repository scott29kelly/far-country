"""LLM-assisted extraction of candidate descriptors from Scripture and Willis."""

from far_country.extract.dedup import citation_key, dedupe, normalize_statement
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
    "ExtractionResult",
    "Extractor",
    "ExtractorError",
    "ModelCaller",
    "ScriptureCitationCandidate",
    "WillisCitationCandidate",
    "citation_key",
    "dedupe",
    "make_anthropic_caller",
    "normalize_statement",
    "render_entity_prompt",
    "render_passage_prompt",
    "render_willis_prompt",
]
