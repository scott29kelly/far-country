"""Typer-based CLI entry point for the Far Country pipeline.

Registered as the `far-country` console script in pyproject.toml.

Currently exposes:

    far-country ingest esv <book> <chapter>
    far-country ingest willis <chapter>

Subsequent PRs add `extract`, `verify`, and `export` subcommands.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from far_country.ingest import ESVClient, load_chapter

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Far Country extraction pipeline.",
)

ingest_app = typer.Typer(no_args_is_help=True, help="Source ingest commands.")
app.add_typer(ingest_app, name="ingest")


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
        pages = (
            f"pp. {section.page_start}-{section.page_end}"
            if section.page_start and section.page_end and section.page_start != section.page_end
            else f"p. {section.page_start}"
            if section.page_start
            else "no page markers"
        )
        typer.echo(f"  {i}. {heading} ({pages})")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
