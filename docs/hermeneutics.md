# Hermeneutics — Interpretive Principles

Far Country claims to be "biblically accurate." This document defines what that means and how the project handles cases where it is not obvious. The hermeneutic codified here is the standard against which descriptors are evaluated. Deviations require a new ADR.

---

## 1. Posture

**Conservative Protestant, literal-where-possible.**

- **Conservative:** the Bible is taken as authoritative and historically reliable. Where Scripture says something about heaven, that is the primary datum, not a starting point to be argued away by external presuppositions.
- **Protestant:** Scripture is the highest authority. Tradition, councils, and respected interpreters are weighed and respected, but Scripture stands above them. The Apocrypha is not in the canon and not treated as a primary source for descriptors (see §5).
- **Literal-where-possible:** when a text plainly asserts something about heaven, it is read as asserting that thing unless the text itself signals otherwise (see §3 on symbolism). "Literal-where-possible" does not mean wooden literalism; it means we do not pre-emptively allegorize plain statements.

---

## 2. Sources, ranked

1. **The ESV Bible** is the canonical translation and the highest source of truth.
2. **Janet Willis, *What on Earth Is Heaven Like?*** is the primary structuring lens — her categories and framing organize the dataset where Scripture itself does not impose an organization. She is not Scripture, but she is the trusted secondary voice.
3. **Respected commentaries and reference works** (e.g., Alcorn's *Heaven*, ESV Study Bible notes, standard commentaries on Revelation, Isaiah, Ezekiel) supply context and language, never primary descriptors.
4. **Wider Christian tradition** (creeds, classical interpreters) informs interpretation where Scripture is genuinely ambiguous.

A descriptor cannot rest on (3) or (4) alone. There must be at least one (1) citation.

---

## 3. Literal, symbolic, and the difference

Scripture itself signals when language is symbolic. The signals include:

- **Genre.** Apocalyptic literature (Daniel 7–12, most of Revelation), prophetic vision (Isaiah 6, Ezekiel 1, Ezekiel 40–48), and Hebrew poetry (Psalms, parts of Job) use figurative language as a normal mode. Symbolism in these passages is the default, not the exception, *for the imagery*. The realities the symbols point to are not symbolic.
- **Visionary framing.** "I saw..." "I was in the Spirit..." "the appearance of the likeness of..." — these explicitly frame imagery as visionary representation.
- **Stated symbolism.** Rev 1:20 ("the seven stars are the angels of the seven churches, and the seven lampstands are the seven churches") explicitly interprets a symbol.
- **Internal absurdity if read literally.** A lamb with seven horns and seven eyes that is also slain and standing (Rev 5:6) is not asking to be diagrammed anatomically.
- **Numerical and structural patterns.** Twelve gates, twelve foundations, 144 cubits, 1,000 years — Scripture's numerical patterns frequently carry symbolic weight, though sometimes also literal measurement.

**Default rule:** if Scripture itself signals symbolism, the descriptor is marked `symbolic` with a `symbolic_referent` field naming what the symbol points to. If Scripture does not signal symbolism, the descriptor is marked `literal` (or, in cases of genuine ambiguity, `fuzzy` or `debated`).

**Example — Streets of gold (Rev 21:21).**
- Tier: `symbolic`
- Literal reading: streets are made of gold like glass.
- Symbolic referent: divine glory, purity, supreme value — gold as the most precious earthly material is used to gesture at heavenly value. Transparent gold underscores that it exceeds known gold.
- The descriptor records *both* the surface image and the referent. We do not assert literal metallurgy, and we do not strip the imagery away.

**Example — Bodily resurrection (1 Cor 15).**
- Tier: `clear` (literal)
- This is not visionary or apocalyptic genre. Paul argues at length for a literal bodily resurrection. The descriptor is recorded literally.

---

## 4. Tier definitions

Every descriptor receives one of four tiers:

| Tier | Meaning | Examples |
| --- | --- | --- |
| `clear` | Scripture states the matter plainly; little or no interpretive dispute among conservative Protestant interpreters | The redeemed will see God face to face (Rev 22:4); there will be no more death (Rev 21:4); the saints will be bodily resurrected (1 Cor 15) |
| `fuzzy` | Scripture touches on the matter but does not give clear shape; multiple legitimate readings exist within the hermeneutic | Whether saints recognize one another by appearance vs. by some other faculty; the relative geography of New Jerusalem features beyond what Rev 21–22 names |
| `debated` | Scripture is invoked by multiple sides reaching different conservative-Protestant conclusions | The relationship between the intermediate state and the final state; the literal vs. symbolic reading of the millennium (Rev 20) as it affects the heavenly picture |
| `symbolic` | Scripture itself signals symbolism (see §3) | Streets of gold; pearl gates; the lamb with seven horns; the sea of glass |

Tiers are not a quality judgment — a `symbolic` descriptor can be as important as a `clear` one. They are routing labels for review and presentation.

---

## 5. What is and is not in scope as a source

**In scope:**
- The 66 books of the Protestant canon, ESV translation.
- Janet Willis's *What on Earth Is Heaven Like?*
- Respected conservative-Protestant commentaries and reference works (as context, not primary descriptors).

**Out of scope (initial version):**
- Deuterocanonical / Apocryphal books.
- Pseudepigrapha (1 Enoch, etc.) — frequently invoked in popular descriptions of heaven, not canonical.
- Patristic, medieval, or modern visionary literature (Aquinas's beatific vision discussions are interpretive; Dante's *Paradiso* is imaginative; Swedenborg is unreliable).
- Other religious traditions.
- AI-generated speculation.

If a descriptor's only source is out-of-scope material, it does not enter the canonical dataset.

---

## 6. Handling disagreement

When sources disagree (Scripture vs. Willis, Willis vs. a commentary, two passages of Scripture that appear to tension):

1. **Scripture wins.** Always.
2. **Tension within Scripture is recorded, not resolved.** If Isaiah 65 and Revelation 21 do not perfectly harmonize on the new earth, the descriptor records both and is tier-tagged `fuzzy` or `debated` rather than smoothed.
3. **Disagreement between Willis and a commentary is recorded in the descriptor's notes.** Willis's reading prevails as the project's structuring lens unless Scripture clearly says otherwise.
4. **The reviewer's job is to surface disagreement, not to suppress it.** A descriptor moved to `needs-discussion` is a feature, not a failure.

---

## 7. What this means for the AI guide (Phase 2)

The Q&A interface must:

- Answer only from approved descriptors.
- Cite the descriptor(s) and through them the Scripture (and Willis) references on every answer.
- Refuse to answer questions for which no grounded descriptor exists, and say so plainly.
- Surface tier when answering — if the answer rests on a `symbolic` or `debated` descriptor, the answer must say so.
- Not import outside doctrinal or speculative material — even from its training corpus — into answers about heaven.

This is enforced architecturally in [`adr/0004-llm-grounding-strategy.md`](adr/0004-llm-grounding-strategy.md).

---

## 8. What this means for the 3D layer (Phase 3)

The world is *generated from the dataset*. The renderer does not invent geography, populate the city with un-cited beings, or extrapolate beyond what descriptors describe. Symbolic descriptors are rendered with a visual indicator (an unobtrusive marker, or a hover-state note) so that the user can distinguish literal from symbolic in space. The visual treatment may take liberties (a pearl gate must look like *something*) but every interactive entity in the scene maps to at least one descriptor.

---

## 9. Change control

This hermeneutic policy is enshrined in [`adr/0005-hermeneutic-policy.md`](adr/0005-hermeneutic-policy.md). Material change to it — adopting a different translation, broadening the source set, shifting interpretive stance — requires a new ADR that supersedes the existing one. The dataset is not retroactively re-tiered without an explicit migration ADR.
