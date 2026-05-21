"""Smoke tests for the typer CLI entry point.

These exercise the CLI wiring (subcommand registration, argument parsing,
output format) but rely on the ingest modules' own tests for correctness.
"""

from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from far_country.cli import app

runner = CliRunner()


def test_top_level_help_lists_ingest() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "ingest" in result.stdout


def test_ingest_help_lists_subcommands() -> None:
    result = runner.invoke(app, ["ingest", "--help"])
    assert result.exit_code == 0
    assert "esv" in result.stdout
    assert "willis" in result.stdout


def test_ingest_willis_reports_chapter_summary(tmp_path: Path) -> None:
    chapter_file = tmp_path / "03-test-chapter.md"
    chapter_file.write_text(
        "# Test chapter\n\n[p.10] Intro.\n\n## Section A\n\n[p.11] Body.\n",
        encoding="utf-8",
    )

    result = runner.invoke(app, ["ingest", "willis", "3", "--willis-dir", str(tmp_path)])

    assert result.exit_code == 0, result.stdout
    assert "Test chapter" in result.stdout
    assert "Sections: 2" in result.stdout
    assert "Section A" in result.stdout


def test_ingest_willis_missing_file_exits_nonzero(tmp_path: Path) -> None:
    result = runner.invoke(app, ["ingest", "willis", "99", "--willis-dir", str(tmp_path)])
    assert result.exit_code != 0
