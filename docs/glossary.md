# Glossary

Project-specific terminology, in alphabetical order. When a term is overloaded with a general meaning, the definition here is the one that governs inside the Far Country project.

---

**Approved descriptor.** A descriptor whose `review_status='approved'`. Only approved descriptors appear in consumer exports.

**Biblically accurate.** As defined by this project: every claim rests on at least one ESV citation, the hermeneutic stance from [`hermeneutics.md`](hermeneutics.md) is honored, symbolic and literal readings are tier-tagged appropriately, and fuzzy or debated material is preserved rather than smoothed.

**Browse UI.** The Phase 2 Next.js interface that lets a user navigate entities and descriptors and follow citations back to source.

**Canonical dataset.** The set of `approved` descriptors and their entities, citations, and relations, stored in `canonical.sqlite` and exported as JSON. The single source of truth for downstream consumers.

**Citation.** A pointer from a descriptor back to its source. Scripture citations carry book/chapter/verse; Willis citations carry chapter/page; secondary citations carry a work title and a locator.

**Confidence tier.** One of `clear`, `fuzzy`, `debated`, `symbolic`. See [`hermeneutics.md`](hermeneutics.md) §4. A routing label, not a quality label.

**Descriptor.** A single, self-contained, citation-grounded claim about an entity in heaven. The atomic unit of the dataset.

**Entity.** A person, place, thing, event, or attribute present in (or characterizing) heaven. See [`data-model.md`](data-model.md) §1.

**Extraction.** The LLM-assisted process of reading a source and producing candidate descriptors with suggested entities, tiers, and citations.

**Far Country.** The project name. Also a biblical-theological theme — heaven as the true homeland from which we are presently exiled (Hebrews 11; Luke 15).

**Grounded answer.** A Q&A response that cites at least one approved descriptor and rests solely on the canonical dataset. Answers that cannot be grounded are refused.

**Ground truth dataset.** Synonym for canonical dataset, emphasizing its function as the authoritative reference against which the rest of the project is built.

**Hermeneutic.** Interpretive principles. Far Country's hermeneutic is conservative Protestant, literal-where-possible. See [`hermeneutics.md`](hermeneutics.md).

**Intermediate state.** The condition of a believer between death and bodily resurrection. One value of `temporal_phase`.

**Final state.** The eternal condition after bodily resurrection and the new heavens-and-new-earth. One value of `temporal_phase`.

**New Jerusalem.** The eternal city of God, described principally in Revelation 21–22. The central place-entity in Phase 3's 3D rendering.

**Pending descriptor.** A descriptor freshly produced by extraction, awaiting human review.

**Provenance.** The metadata that records how a descriptor was produced — the extraction run, prompt version, model, and source scope.

**Review queue.** The set of descriptors with `review_status='pending'` or `'needs-discussion'`. Worked through by a human reviewer via the review UI.

**Reviewer.** The human (initially: the project owner) who triages the review queue. The reviewer is the gatekeeper of the canonical dataset.

**Source scope.** A label identifying what subset of source material an extraction run processed, e.g., `esv:revelation:21-22` or `willis:ch3`.

**Symbolic referent.** What a symbolic descriptor points to. Required for any descriptor with `tier='symbolic'`. Example: for "streets of gold," the symbolic referent is "divine glory, supreme value, purity."

**Tier.** Synonym for confidence tier.

**Temporal phase.** Whether a descriptor describes the intermediate state, the final state, both, or unspecified. See [`data-model.md`](data-model.md) §3.

**Willis.** Shorthand in this project for Janet Willis, *What on Earth Is Heaven Like? A Look at God's City New Jerusalem*.

**World model.** The structured representation of heaven that the project builds — entities, descriptors, relations, organized so that downstream consumers (browse UI, Q&A, 3D world) can render the same reality through different surfaces.
