"""SQLAlchemy ORM models for the canonical store.

These mirror the raw-SQL schema in `migrations/`, which is the source of
truth. When the schema changes, update both files together.
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

ENTITY_TYPES = ("person", "place", "thing", "event", "attribute")
TIERS = ("clear", "fuzzy", "debated", "symbolic")
TEMPORAL_PHASES = ("intermediate", "final", "either", "unspecified")
REVIEW_STATUSES = ("pending", "approved", "rejected", "needs-discussion")
SOURCE_TYPES = ("scripture", "willis", "secondary")
VERIFICATION_STATUSES = ("pass", "partial", "fail")
DIMENSIONS = (
    "length",
    "breadth",
    "height",
    "thickness",
    "depth",
    "distance",
    "side",
    "count",
)
MEASUREMENT_UNITS = (
    "long-cubit",
    "cubit",
    "reed",
    "handbreadth",
    "span",
    "stadia",
    "step",
    "story",
    "item",
)


def _in_clause(column: str, values: tuple[str, ...]) -> str:
    quoted = ",".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class Base(DeclarativeBase):
    pass


class Entity(Base):
    __tablename__ = "entity"
    __table_args__ = (
        CheckConstraint(_in_clause("entity_type", ENTITY_TYPES), name="ck_entity_type"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    descriptors: Mapped[list[Descriptor]] = relationship(
        back_populates="entity", foreign_keys="Descriptor.entity_id"
    )


class Descriptor(Base):
    __tablename__ = "descriptor"
    __table_args__ = (
        CheckConstraint(_in_clause("tier", TIERS), name="ck_descriptor_tier"),
        CheckConstraint(
            f"temporal_phase IS NULL OR {_in_clause('temporal_phase', TEMPORAL_PHASES)}",
            name="ck_descriptor_temporal_phase",
        ),
        CheckConstraint(
            _in_clause("review_status", REVIEW_STATUSES),
            name="ck_descriptor_review_status",
        ),
        CheckConstraint(
            "tier != 'symbolic' OR symbolic_referent IS NOT NULL",
            name="ck_descriptor_symbolic_referent_required",
        ),
        Index("idx_descriptor_entity", "entity_id"),
        Index("idx_descriptor_tier", "tier"),
        Index("idx_descriptor_status", "review_status"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    entity_id: Mapped[str] = mapped_column(Text, ForeignKey("entity.id"), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    tier: Mapped[str] = mapped_column(Text, nullable=False)
    symbolic_referent: Mapped[str | None] = mapped_column(Text)
    temporal_phase: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    provenance: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    entity: Mapped[Entity] = relationship(back_populates="descriptors", foreign_keys=[entity_id])
    citations: Mapped[list[Citation]] = relationship(back_populates="descriptor")


class Citation(Base):
    __tablename__ = "citation"
    __table_args__ = (
        CheckConstraint(_in_clause("source_type", SOURCE_TYPES), name="ck_citation_source_type"),
        Index("idx_citation_descriptor", "descriptor_id"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    descriptor_id: Mapped[str] = mapped_column(Text, ForeignKey("descriptor.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    book: Mapped[str | None] = mapped_column(Text)
    chapter: Mapped[int | None] = mapped_column(Integer)
    verse_start: Mapped[int | None] = mapped_column(Integer)
    verse_end: Mapped[int | None] = mapped_column(Integer)
    willis_chapter: Mapped[str | None] = mapped_column(Text)
    willis_page_start: Mapped[int | None] = mapped_column(Integer)
    willis_page_end: Mapped[int | None] = mapped_column(Integer)
    secondary_work: Mapped[str | None] = mapped_column(Text)
    secondary_locator: Mapped[str | None] = mapped_column(Text)
    quote: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    descriptor: Mapped[Descriptor] = relationship(back_populates="citations")


class Measurement(Base):
    """A cited dimensional fact (ADR 0017).

    Values are text-native (long cubits, reeds, spans, stadia, counts) —
    never a metric conversion; the units/scale resolver (ADR 0018) converts
    at consumption. Ids are stable slugs: geometry code references
    measurements by id.
    """

    __tablename__ = "measurement"
    __table_args__ = (
        CheckConstraint(_in_clause("dimension", DIMENSIONS), name="ck_measurement_dimension"),
        CheckConstraint(_in_clause("unit", MEASUREMENT_UNITS), name="ck_measurement_unit"),
        CheckConstraint(_in_clause("tier", TIERS), name="ck_measurement_tier"),
        CheckConstraint(
            _in_clause("review_status", REVIEW_STATUSES),
            name="ck_measurement_review_status",
        ),
        Index("idx_measurement_entity", "entity_id"),
        Index("idx_measurement_status", "review_status"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    entity_id: Mapped[str] = mapped_column(Text, ForeignKey("entity.id"), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    dimension: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    basis: Mapped[str | None] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    provenance: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    citations: Mapped[list[MeasurementCitation]] = relationship(back_populates="measurement")


class MeasurementCitation(Base):
    """Citation for a measurement — same shape as `Citation`, additive mirror."""

    __tablename__ = "measurement_citation"
    __table_args__ = (
        CheckConstraint(
            _in_clause("source_type", SOURCE_TYPES),
            name="ck_measurement_citation_source_type",
        ),
        Index("idx_measurement_citation_measurement", "measurement_id"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    measurement_id: Mapped[str] = mapped_column(
        Text, ForeignKey("measurement.id"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    book: Mapped[str | None] = mapped_column(Text)
    chapter: Mapped[int | None] = mapped_column(Integer)
    verse_start: Mapped[int | None] = mapped_column(Integer)
    verse_end: Mapped[int | None] = mapped_column(Integer)
    willis_chapter: Mapped[str | None] = mapped_column(Text)
    willis_page_start: Mapped[int | None] = mapped_column(Integer)
    willis_page_end: Mapped[int | None] = mapped_column(Integer)
    secondary_work: Mapped[str | None] = mapped_column(Text)
    secondary_locator: Mapped[str | None] = mapped_column(Text)
    quote: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    measurement: Mapped[Measurement] = relationship(back_populates="citations")


class EntityRelation(Base):
    __tablename__ = "entity_relation"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    from_entity_id: Mapped[str] = mapped_column(Text, ForeignKey("entity.id"), nullable=False)
    to_entity_id: Mapped[str] = mapped_column(Text, ForeignKey("entity.id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class ExtractionRun(Base):
    __tablename__ = "extraction_run"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    started_at: Mapped[str] = mapped_column(Text, nullable=False)
    completed_at: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)
    source_scope: Mapped[str] = mapped_column(Text, nullable=False)
    descriptor_count: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)


class Verification(Base):
    """One citation-verification check, persisted from `far-country verify run`.

    Mirrors `verify.VerificationResult`, plus the `run_id` it was produced
    under and a `created_at` stamp. Re-running verification inserts a new
    row rather than overwriting — past verdicts stay queryable.
    """

    __tablename__ = "verification"
    __table_args__ = (
        CheckConstraint(
            _in_clause("status", VERIFICATION_STATUSES),
            name="ck_verification_status",
        ),
        CheckConstraint(
            f"judge_status IS NULL OR {_in_clause('judge_status', VERIFICATION_STATUSES)}",
            name="ck_verification_judge_status",
        ),
        Index("idx_verification_run", "run_id"),
        Index("idx_verification_descriptor", "descriptor_id"),
        Index("idx_verification_citation", "citation_id"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    descriptor_id: Mapped[str] = mapped_column(Text, ForeignKey("descriptor.id"), nullable=False)
    citation_id: Mapped[str] = mapped_column(Text, ForeignKey("citation.id"), nullable=False)
    run_id: Mapped[str] = mapped_column(Text, ForeignKey("extraction_run.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    judge_status: Mapped[str | None] = mapped_column(Text)
    judge_rationale: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
