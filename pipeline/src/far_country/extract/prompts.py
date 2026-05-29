"""Versioned prompt templates for the three extraction modes.

`PROMPT_VERSION` is recorded with every extraction run (see
`docs/data-model.md` — `extraction_run.prompt_version`). Bump the version
whenever a template changes meaningfully so we can compare runs.

Three modes per `docs/extraction-pipeline.md` §3.1:
- **passage**: given a Scripture passage, surface every descriptor it supports.
- **entity**: given an entity slug, surface descriptors from a corpus of
  passages that bear on it.
- **willis**: given a Willis chapter, extract her claims and tag them.
"""

from __future__ import annotations

from typing import Final

from far_country.ingest import Passage, WillisChapter

PROMPT_VERSION: Final = "0.3.0"

_HERMENEUTIC_PREAMBLE: Final = """\
You are extracting candidate descriptors of heaven for the Far Country project.

HERMENEUTIC:
- Conservative Protestant, literal-where-possible.
- Mark a descriptor `symbolic` only when the text genre signals symbolism
  (apocalyptic vision, prophetic vision, declared symbolism, internal
  absurdity if read literally) — and supply a `symbolic_referent`
  identifying what the symbol points to.
- Mark `fuzzy` when the passage supports the claim but with significant
  interpretive latitude; `debated` when responsible interpreters disagree.
- Otherwise mark `clear`.

ESCHATOLOGICAL FRAMING (locked in ADR 0012 — premillennial, pre-wrath
New Creationism; supersedes ADR 0008):
- PREMILLENNIAL READING OF REVELATION 20. The "thousand years" is a
  LITERAL future millennial kingdom — a 1,000-year reign of Christ after
  his return, distinct from both the present age and the eternal state.
  The first resurrection (Rev 20:4-6) is a real bodily resurrection of
  the redeemed at the millennium's start. Extract millennium-referencing
  material with the tier the text warrants (`clear`/`fuzzy`); do NOT
  recast it as a symbol of the present church age.
- THREE PHASES, NOT TWO. Redemptive history runs: the intermediate
  state, the millennial kingdom, then the eternal state. A descriptor
  may pertain to any of them.
- LITERAL EZEKIEL TEMPLE. Ezekiel 40-48 describes a literal future
  millennial temple with a functioning priesthood in restored national
  Israel — distinct from and adjacent to the New Jerusalem (which has no
  temple, Rev 21:22). Do not read it as already-fulfilled typology.
- INTERMEDIATE STATE IS LIVE. Believers who die before the first
  resurrection are consciously with Christ in the interim (2 Cor 5:8;
  Phil 1:23; Luke 23:43) while awaiting bodily resurrection. This is a
  real, distinct state, not a collapsed one.
- RENEWAL OVER ANNIHILATION for the new heavens and new earth
  (continuity of the physical creation).

TIER ROUTING (not a quality label, a review-routing label):
- clear: plain reading of the text supports it.
- fuzzy: text supports a range of readings; pick the most defensible.
- debated: responsible interpreters disagree.
- symbolic: requires a symbolic_referent.

TEMPORAL_PHASE ROUTING:
- intermediate: the descriptor pertains specifically to the state of the
  redeemed between death and the (first) resurrection — disembodied,
  consciously with Christ (e.g. 2 Cor 5:8, Phil 1:23, Luke 23:43, the
  spirits of the righteous made perfect in Heb 12:23, the souls under
  the altar in Rev 6:9-11). This is the DEFAULT for believer-with-Christ-
  at-death claims.
- final: the descriptor pertains specifically to the eternal state after
  the general resurrection and the new creation in its final, deathless
  form (e.g. the bodily resurrection itself, the absence of death, the
  new-earth motif).
- either: the descriptor is true of the redeemed regardless of phase
  (e.g. the presence of God, seeing his face).
- unspecified: the source text does not pin a phase and neither context
  nor genre selects one. NOTE: the schema has no `millennial` value yet
  (see docs/data-model.md); for a descriptor that is specifically
  millennial, prefer `unspecified` rather than forcing it into `final`,
  until the schema gains a millennial phase.

DO NOT:
- Invent claims not grounded in the cited verses.
- Cite verses outside the canonical 66 books.
- Paraphrase content the text does not contain.
- Write meta-claims ("Revelation 21 says..."). Write the claim itself.
- Flatten the millennium into the present church age, or read Ezekiel's
  temple as merely symbolic / already-fulfilled typology.
- Deny or collapse the intermediate state.

If a passage is fuzzy or debated, EXTRACT it with the right tier rather
than skipping it.
"""

_OUTPUT_FORMAT_SCRIPTURE: Final = """\
OUTPUT FORMAT:
Return a JSON array. Each element is one candidate descriptor with this shape:

{
  "statement": "A single self-contained claim about heaven.",
  "entity_id_suggestion": "kebab-case-slug",
  "entity_name_suggestion": "Display name",
  "entity_type_suggestion": "person|place|thing|event|attribute",
  "tier": "clear|fuzzy|debated|symbolic",
  "symbolic_referent": null,
  "temporal_phase": "intermediate|final|either|unspecified",
  "citations": [
    {
      "source_type": "scripture",
      "book": "Revelation",
      "chapter": 21,
      "verse_start": 2,
      "verse_end": null
    }
  ]
}

Return ONLY the JSON array, no prose, no markdown fences.
"""

_OUTPUT_FORMAT_WILLIS: Final = """\
OUTPUT FORMAT:
Return a JSON array. Each element is one candidate descriptor with this shape:

{
  "statement": "A single self-contained claim about heaven.",
  "entity_id_suggestion": "kebab-case-slug",
  "entity_name_suggestion": "Display name",
  "entity_type_suggestion": "person|place|thing|event|attribute",
  "tier": "fuzzy|debated|clear|symbolic",
  "symbolic_referent": null,
  "temporal_phase": "intermediate|final|either|unspecified",
  "citations": [
    {
      "source_type": "willis",
      "willis_chapter": "3",
      "willis_page_start": 42,
      "willis_page_end": null
    }
  ]
}

If Willis cites Scripture for a claim, ALSO emit a scripture citation in
the same `citations` array (Scripture is primary, Willis is secondary).

A Willis claim not backed by Scripture in her own text must be tagged
`fuzzy` or `debated`, not `clear`.

Return ONLY the JSON array, no prose, no markdown fences.
"""


def _format_passage_text(passage: Passage) -> str:
    lines = [f"PASSAGE: {passage.canonical}", "TEXT:"]
    for verse in passage.verses:
        lines.append(f"  [{verse.verse}] {verse.text}")
    if not passage.verses:
        lines.append(passage.raw_text.strip())
    return "\n".join(lines)


def _format_entity_hints(hints: list[str]) -> str:
    if not hints:
        return "ENTITY HINTS: (no prior entities; suggest fresh slugs)"
    bulleted = "\n".join(f"  - {h}" for h in hints)
    return f"ENTITY HINTS (prefer reusing these slugs when they fit):\n{bulleted}"


def render_passage_prompt(
    passage: Passage, entity_hints: list[str] | None = None
) -> tuple[str, str]:
    """Return `(system, user)` strings for a passage-driven extraction."""
    system = _HERMENEUTIC_PREAMBLE + "\n" + _OUTPUT_FORMAT_SCRIPTURE
    user = "\n\n".join(
        [
            _format_passage_text(passage),
            _format_entity_hints(entity_hints or []),
            "Extract every candidate descriptor this passage supports.",
        ]
    )
    return system, user


def render_entity_prompt(
    entity_slug: str,
    entity_name: str,
    passages: list[Passage],
) -> tuple[str, str]:
    """Return `(system, user)` for an entity-driven extraction across passages."""
    system = _HERMENEUTIC_PREAMBLE + "\n" + _OUTPUT_FORMAT_SCRIPTURE
    passage_blocks = "\n\n".join(_format_passage_text(p) for p in passages)
    user = "\n\n".join(
        [
            f"ENTITY: {entity_name} (slug: {entity_slug})",
            passage_blocks if passages else "(no passages provided)",
            f"From the passages above, extract every descriptor that bears on "
            f"the entity {entity_name!r}. Cite the exact verse range for each.",
        ]
    )
    return system, user


def _format_willis_chapter(chapter: WillisChapter) -> str:
    lines = [
        f"WILLIS CHAPTER {chapter.chapter_number}: {chapter.title}",
        "SECTIONS:",
    ]
    for i, section in enumerate(chapter.sections, 1):
        heading = section.heading or "(intro)"
        pages = (
            f"pp. {section.page_start}-{section.page_end}"
            if section.page_start and section.page_end and section.page_start != section.page_end
            else f"p. {section.page_start}"
            if section.page_start
            else "no page markers"
        )
        lines.append(f"  [{i}] {heading} ({pages})")
        lines.append(section.text)
        lines.append("")
    return "\n".join(lines)


def render_willis_prompt(chapter: WillisChapter) -> tuple[str, str]:
    """Return `(system, user)` for a Willis-chapter extraction."""
    system = _HERMENEUTIC_PREAMBLE + "\n" + _OUTPUT_FORMAT_WILLIS
    user = "\n\n".join(
        [
            _format_willis_chapter(chapter),
            f"Use the chapter number {chapter.chapter_number!r} as the "
            "`willis_chapter` value and the section's page range for the "
            "Willis citation. If Willis cites Scripture in her text for a "
            "claim, emit a scripture citation alongside the Willis one.",
        ]
    )
    return system, user
