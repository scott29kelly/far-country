"""Typer-based CLI entry point for the Far Country pipeline.

Registered as the `far-country` console script in pyproject.toml.

Currently exposes:

    far-country ingest esv <book> <chapter>
    far-country ingest willis <chapter>
    far-country extract passage <book:chapter>
    far-country extract entity <slug> --passage <book:chapter> [...]
    far-country extract willis <chapter>
    far-country verify run <run-id>
    far-country export

`extract` subcommands persist into the canonical SQLite store at
`data/canonical.sqlite` by default; pass `--db-path` to override or
`--dry-run` to skip writes. The `verify` subcommand runs the
keyword-overlap citation check over the descriptors written by a given
extraction run and prints a JSON report. `export` writes the canonical
JSON files consumed by Phase 2.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from far_country.export import (
    SchemaValidationError,
    build_canonical_export,
    build_entity_exports,
    validate_canonical,
    validate_entity,
    write_canonical_export,
    write_manifest,
)
from far_country.extract import (
    DEFAULT_MODEL,
    Extractor,
    ExtractorError,
    PersistOutcome,
    dedupe,
    make_anthropic_caller,
    persist_extraction,
)
from far_country.extract.extractor import ExtractionResult
from far_country.ingest import ESVClient, Passage, load_chapter
from far_country.store import (
    DEFAULT_DB_PATH,
    Descriptor,
    create_engine_for_path,
    create_session_factory,
    init_db,
)
from far_country.store.models import Citation, ExtractionRun
from far_country.verify import (
    VerificationResult,
    verify_descriptor,
)

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Far Country extraction pipeline.",
)

ingest_app = typer.Typer(no_args_is_help=True, help="Source ingest commands.")
app.add_typer(ingest_app, name="ingest")

extract_app = typer.Typer(no_args_is_help=True, help="LLM-assisted extraction commands.")
app.add_typer(extract_app, name="extract")

verify_app = typer.Typer(no_args_is_help=True, help="Citation verification commands.")
app.add_typer(verify_app, name="verify")

DEFAULT_EXPORT_DIR = Path("data/exports")


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


def _emit_persist_outcome(outcome: PersistOutcome, db_path: Path) -> None:
    typer.echo(
        f"Persisted to {db_path}: "
        f"run_id={outcome.run_id} "
        f"new_entities={len(outcome.inserted_entities)} "
        f"new_descriptors={len(outcome.inserted_descriptor_ids)} "
        f"skipped_duplicates={len(outcome.skipped_duplicate_statements)}"
    )


def _persist_or_dry_run(
    result: ExtractionResult,
    *,
    db_path: Path,
    dry_run: bool,
) -> None:
    """Either persist the result or, in dry-run mode, dump candidates as JSON."""
    if dry_run:
        _emit_result(result, dedup=True)
        return

    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine_for_path(db_path)
    init_db(engine)
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        outcome = persist_extraction(session, result)
    _emit_persist_outcome(outcome, db_path)


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
    db_path: Annotated[
        Path,
        typer.Option("--db-path", help="Canonical SQLite DB path."),
    ] = DEFAULT_DB_PATH,
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", help="Skip DB writes; dump candidates as JSON."),
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
    _persist_or_dry_run(result, db_path=db_path, dry_run=dry_run)


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
    db_path: Annotated[Path, typer.Option("--db-path")] = DEFAULT_DB_PATH,
    dry_run: Annotated[bool, typer.Option("--dry-run")] = False,
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
    _persist_or_dry_run(result, db_path=db_path, dry_run=dry_run)


@extract_app.command("willis")
def extract_willis(
    chapter: Annotated[int, typer.Argument(help="Willis chapter number.")],
    willis_dir: Annotated[Path | None, typer.Option("--willis-dir")] = None,
    model: Annotated[str, typer.Option("--model")] = DEFAULT_MODEL,
    db_path: Annotated[Path, typer.Option("--db-path")] = DEFAULT_DB_PATH,
    dry_run: Annotated[bool, typer.Option("--dry-run")] = False,
) -> None:
    """Extract candidate descriptors from a Willis chapter."""
    chap = load_chapter(chapter, willis_dir=willis_dir)
    extractor = _build_default_extractor(model)
    try:
        result = extractor.extract_from_willis(chap)
    except ExtractorError as exc:
        raise typer.Exit(code=2) from exc
    _persist_or_dry_run(result, db_path=db_path, dry_run=dry_run)


# ---------------------------------------------------------------- verify


class _ESVOnlyFetcher:
    """`CitationFetcher` that resolves scripture via a cached `ESVClient`.

    Willis citations are not fetchable here (no Willis text is shipped);
    the CLI surfaces a clear error if it sees one. A richer
    multi-source fetcher belongs in a follow-up PR.
    """

    def __init__(self, client: ESVClient) -> None:
        self._client = client

    def fetch(self, citation: Citation) -> str:
        if citation.source_type == "scripture":
            if citation.book is None or citation.chapter is None:
                raise ValueError(
                    f"Scripture citation {citation.id} missing book/chapter; cannot fetch."
                )
            passage = self._client.get_passage(citation.book, citation.chapter)
            return _slice_verses(
                passage,
                verse_start=citation.verse_start,
                verse_end=citation.verse_end,
            )
        raise ValueError(
            f"Citation {citation.id} has unsupported source_type "
            f"{citation.source_type!r} for this fetcher."
        )


def _slice_verses(
    passage: Passage,
    *,
    verse_start: int | None,
    verse_end: int | None,
) -> str:
    """Return the joined text of the passage's verses within an inclusive range."""
    if verse_start is None:
        return passage.raw_text
    end = verse_end if verse_end is not None else verse_start
    selected = [v for v in passage.verses if verse_start <= v.verse <= end]
    return " ".join(v.text for v in selected) if selected else passage.raw_text


@verify_app.command("run")
def verify_run(
    run_id: Annotated[str, typer.Argument(help="Extraction run id to verify descriptors for.")],
    db_path: Annotated[Path, typer.Option("--db-path")] = DEFAULT_DB_PATH,
    cache_dir: Annotated[
        Path | None,
        typer.Option("--cache-dir", help="ESV cache directory override."),
    ] = None,
) -> None:
    """Run keyword-overlap citation verification over the descriptors of a run.

    Descriptors are matched by the `run_id` embedded in `descriptor.provenance`.
    """
    engine = create_engine_for_path(db_path)
    init_db(engine)
    session_factory = create_session_factory(engine)
    descriptors_by_id: list[Descriptor] = []
    run_row: ExtractionRun | None = None
    with session_factory() as session:
        run_row = session.get(ExtractionRun, run_id)
        if run_row is None:
            typer.echo(f"No extraction_run row with id {run_id!r}", err=True)
            raise typer.Exit(code=2)
        descriptors_by_id = _descriptors_for_run(session, run_id)

    if not descriptors_by_id:
        typer.echo(f"No descriptors found for run {run_id}", err=True)
        raise typer.Exit(code=1)

    results: list[VerificationResult] = []
    with ESVClient(cache_dir=cache_dir) as client:
        fetcher = _ESVOnlyFetcher(client)
        for descriptor in descriptors_by_id:
            results.extend(verify_descriptor(descriptor, fetcher=fetcher))

    typer.echo(
        f"Verified {len(descriptors_by_id)} descriptor(s) "
        f"({len(results)} citation check(s)) for run {run_id}"
    )
    typer.echo(
        json.dumps(
            [json.loads(r.to_json()) for r in results],
            indent=2,
            sort_keys=True,
        )
    )


def _descriptors_for_run(session, run_id: str) -> list[Descriptor]:
    """Return descriptors whose provenance JSON references `run_id`.

    Provenance is stored as JSON in a text column, so we do the filter in
    Python rather than via a JSON1 query — keeps the migration footprint
    zero and SQLite-version-agnostic.
    """
    from sqlalchemy import select

    matches: list[Descriptor] = []
    for descriptor in session.scalars(select(Descriptor)).unique():
        if not descriptor.provenance:
            continue
        try:
            payload = json.loads(descriptor.provenance)
        except json.JSONDecodeError:
            continue
        if payload.get("run_id") == run_id:
            matches.append(descriptor)
    return matches


# ---------------------------------------------------------------- export


@app.command("export")
def export_command(
    db_path: Annotated[Path, typer.Option("--db-path")] = DEFAULT_DB_PATH,
    out_dir: Annotated[
        Path,
        typer.Option("--out-dir", help="Directory to write JSON exports into."),
    ] = DEFAULT_EXPORT_DIR,
    include_pending: Annotated[
        bool,
        typer.Option(
            "--include-pending",
            help="Include non-approved descriptors (debug snapshots only — never ship).",
        ),
    ] = False,
    skip_validation: Annotated[
        bool,
        typer.Option(
            "--skip-validation",
            help="Skip JSON Schema validation (use only when iterating on schema changes).",
        ),
    ] = False,
) -> None:
    """Write canonical.json + per-entity JSON + manifest.json from the store."""
    engine = create_engine_for_path(db_path)
    init_db(engine)
    session_factory = create_session_factory(engine)

    with session_factory() as session:
        canonical = build_canonical_export(session, include_pending=include_pending)
        entity_exports = build_entity_exports(session, include_pending=include_pending)

    if not skip_validation:
        try:
            validate_canonical(canonical.to_dict())
            for export in entity_exports:
                validate_entity(export.to_dict())
        except SchemaValidationError as exc:
            typer.echo(str(exc), err=True)
            raise typer.Exit(code=2) from exc

    with session_factory() as session:
        written = write_canonical_export(session, out_dir, include_pending=include_pending)

    entity_filenames = [
        f"entities/{name.split(':', 1)[1]}.json" for name in written if name.startswith("entity:")
    ]
    manifest_path = write_manifest(out_dir, canonical=canonical, entity_filenames=entity_filenames)

    typer.echo(f"Wrote {written['canonical']}")
    for label, path in written.items():
        if label.startswith("entity:"):
            typer.echo(f"Wrote {path}")
    typer.echo(f"Wrote {manifest_path}")
    typer.echo(
        f"Exported {len(canonical.entities)} entity(ies), "
        f"{len(canonical.descriptors)} descriptor(s), "
        f"{len(canonical.citations)} citation(s)."
    )


def main() -> None:
    app()


if __name__ == "__main__":
    main()
