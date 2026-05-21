"""Typer-based CLI entry point for the Far Country pipeline.

Registered as the `far-country` console script in pyproject.toml.

Currently exposes:

    far-country ingest esv <book> <chapter>
    far-country ingest willis <chapter>
    far-country extract passage <book:chapter>
    far-country extract entity <slug> --passage <book:chapter> [...]
    far-country extract willis <chapter>

Subsequent PRs add `verify` and `export` subcommands.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from far_country.extract import (
    DEFAULT_MODEL,
    Extractor,
    ExtractorError,
    dedupe,
    make_anthropic_caller,
)
from far_country.extract.extractor import ExtractionResult
from far_country.ingest import ESVClient, Passage, load_chapter

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Far Country extraction pipeline.",
)

ingest_app = typer.Typer(no_args_is_help=True, help="Source ingest commands.")
app.add_typer(ingest_app, name="ingest")

extract_app = typer.Typer(no_args_is_help=True, help="LLM-assisted extraction commands.")
app.add_typer(extract_app, name="extract")


# ---------------------------------------------------------------- ingest


@ingest_app.command("esv")
def ingest_esv(
    book: Annotated[str, typer.Argument(help="ESV book name, e.g. 'Revelation'.")],
    chapter: Annotated[int, typer.Argument(help="Chapter number, e.g. 21.")],
    cache_dir: Annotated[
        Path | None,
        typer.Option(
            "--cache-dir",
            help="Override the on-disk cache directory (defaults to data/raw/esv/).",
        ),
    ] = None,
) -> None:
    """Fetch and cache a passage from the ESV API."""
    with ESVClient(cache_dir=cache_dir) as client:
        passage = client.get_passage(book, chapter)
    typer.echo(f"Fetched {passage.canonical}: {len(passage.verses)} verses")
    typer.echo(f"Cached: {client.cache_path(book, chapter)}")


@ingest_app.command("willis")
def ingest_willis(
    chapter: Annotated[int, typer.Argument(help="Willis chapter number, e.g. 3.")],
    willis_dir: Annotated[
        Path | None,
        typer.Option(
            "--willis-dir",
            help="Override the Willis directory (defaults to data/raw/willis/).",
        ),
    ] = None,
) -> None:
    """Load and summarize a Willis chapter file."""
    chap = load_chapter(chapter, willis_dir=willis_dir)
    typer.echo(f"Loaded Willis chapter {chap.chapter_number}: {chap.title}")
    typer.echo(f"Source: {chap.source_path}")
    typer.echo(f"Sections: {len(chap.sections)}")
    for i, section in enumerate(chap.sections, 1):
        heading = section.heading or "(intro)"
        pages = _format_pages(section.page_start, section.page_end)
        typer.echo(f"  {i}. {heading} ({pages})")


# ---------------------------------------------------------------- extract


def _parse_passage_ref(ref: str) -> tuple[str, int]:
    """Parse 'Book:Chapter' into `(book, chapter)`.

    Verse ranges (e.g. 'Revelation:21:1-5') are accepted for forward
    compatibility but ignored — the extractor operates on whole chapters
    in this PR.
    """
    parts = ref.split(":")
    if len(parts) < 2:
        raise typer.BadParameter(f"Expected 'Book:Chapter' (e.g. 'Revelation:21'), got {ref!r}")
    try:
        chapter = int(parts[1])
    except ValueError as exc:
        raise typer.BadParameter(f"Chapter must be an integer, got {parts[1]!r}") from exc
    return parts[0], chapter


def _format_pages(page_start: int | None, page_end: int | None) -> str:
    if page_start is None:
        return "no page markers"
    if page_end is None or page_end == page_start:
        return f"p. {page_start}"
    return f"pp. {page_start}-{page_end}"


def _build_default_extractor(model: str) -> Extractor:
    """Construct an Extractor backed by a real Anthropic client.

    Imported lazily so tests that mock the extractor don't pay the SDK
    import cost and can run without `ANTHROPIC_API_KEY` in env.
    """
    import anthropic

    client = anthropic.Anthropic()
    return Extractor(make_anthropic_caller(client, model=model), model=model)


def _emit_result(result: ExtractionResult, *, dedup: bool) -> None:
    candidates = dedupe(result.candidates) if dedup else result.candidates
    typer.echo(
        f"Extracted {len(candidates)} candidate(s) "
        f"({len(result.candidates) - len(candidates)} duplicates removed) "
        f"from {result.source_scope} "
        f"using {result.model} @ prompt v{result.prompt_version}"
    )
    payload = [c.model_dump(mode="json") for c in candidates]
    typer.echo(json.dumps(payload, indent=2))


@extract_app.command("passage")
def extract_passage(
    ref: Annotated[
        str,
        typer.Argument(help="Passage reference, e.g. 'Revelation:21'."),
    ],
    model: Annotated[
        str,
        typer.Option("--model", help="Anthropic model to use."),
    ] = DEFAULT_MODEL,
    cache_dir: Annotated[
        Path | None,
        typer.Option("--cache-dir", help="ESV cache directory override."),
    ] = None,
    no_dedup: Annotated[
        bool,
        typer.Option("--no-dedup", help="Skip deduplication of the output."),
    ] = False,
) -> None:
    """Extract candidate descriptors from a single Scripture passage."""
    book, chapter = _parse_passage_ref(ref)
    with ESVClient(cache_dir=cache_dir) as client:
        passage = client.get_passage(book, chapter)
    extractor = _build_default_extractor(model)
    try:
        result = extractor.extract_from_passage(passage)
    except ExtractorError as exc:
        raise typer.Exit(code=2) from exc
    _emit_result(result, dedup=not no_dedup)


@extract_app.command("entity")
def extract_entity(
    slug: Annotated[str, typer.Argument(help="Entity slug, e.g. 'new-jerusalem'.")],
    name: Annotated[str, typer.Option("--name", help="Entity display name.")],
    passage_refs: Annotated[
        list[str],
        typer.Option(
            "--passage",
            help="Passage references to consider; repeatable, e.g. 'Revelation:21'.",
        ),
    ],
    model: Annotated[str, typer.Option("--model")] = DEFAULT_MODEL,
    cache_dir: Annotated[Path | None, typer.Option("--cache-dir")] = None,
    no_dedup: Annotated[bool, typer.Option("--no-dedup")] = False,
) -> None:
    """Extract descriptors for one entity across multiple passages."""
    parsed = [_parse_passage_ref(r) for r in passage_refs]
    passages: list[Passage] = []
    with ESVClient(cache_dir=cache_dir) as client:
        for book, chapter in parsed:
            passages.append(client.get_passage(book, chapter))
    extractor = _build_default_extractor(model)
    try:
        result = extractor.extract_for_entity(slug, name, passages)
    except ExtractorError as exc:
        raise typer.Exit(code=2) from exc
    _emit_result(result, dedup=not no_dedup)


@extract_app.command("willis")
def extract_willis(
    chapter: Annotated[int, typer.Argument(help="Willis chapter number.")],
    willis_dir: Annotated[Path | None, typer.Option("--willis-dir")] = None,
    model: Annotated[str, typer.Option("--model")] = DEFAULT_MODEL,
    no_dedup: Annotated[bool, typer.Option("--no-dedup")] = False,
) -> None:
    """Extract candidate descriptors from a Willis chapter."""
    chap = load_chapter(chapter, willis_dir=willis_dir)
    extractor = _build_default_extractor(model)
    try:
        result = extractor.extract_from_willis(chap)
    except ExtractorError as exc:
        raise typer.Exit(code=2) from exc
    _emit_result(result, dedup=not no_dedup)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
