# Sources

Far Country uses a deliberately narrow source set. This document lists every source and its role.

---

## 1. Primary source: the ESV Bible

- **Full title:** The Holy Bible, English Standard Version
- **Publisher:** Crossway, a publishing ministry of Good News Publishers
- **Copyright:** © 2001 Crossway. All rights reserved.
- **Role:** Primary source of truth. Every descriptor of heaven must rest on at least one ESV citation.
- **Access:** ESV API (https://api.esv.org/) during development. Cached locally under `data/cache/esv/`. Not committed.
- **Licensing posture:** Personal-study use during development. Public distribution requires Crossway permissions / API terms compliance. See [`adr/0006-source-licensing-posture.md`](adr/0006-source-licensing-posture.md).
- **Citation format in this project:** `<Book> <chapter>:<verse>` (e.g., "Revelation 21:21"). For ranges: `<Book> <chapter>:<verse_start>–<verse_end>`.

---

## 2. Primary secondary source: Janet Willis

- **Full title:** *What on Earth Is Heaven Like? A Look at God's City New Jerusalem*
- **Author:** Janet Willis
- **Role:** Structuring lens. Her chapters and the questions she organizes them around shape the initial entity categorization. Her claims become descriptors when backed by Scripture (with Scripture as the primary citation and Willis as secondary). Her claims that are not Scripture-backed enter the dataset only as `fuzzy` or `debated` candidates for review.
- **Access:** Held locally in `data/raw/willis/`. Not committed.
- **Licensing posture:** Personal-study use during development. Any public distribution of summaries or excerpts requires explicit permission from the rights holder.
- **Citation format in this project:** Chapter and page range, e.g., "Willis, ch. 5, pp. 78–82."

---

## 3. Supporting / context sources (not primary)

These supply context, terminology, and interpretive frame. They cannot stand as the sole source of a descriptor.

- **ESV Study Bible** (Crossway) — notes and articles on heaven, Revelation, eschatology.
- **Randy Alcorn, *Heaven*** — useful as a popular synthesis with extensive Scripture indexing. Often a good starting point for finding the relevant passages.
- **Standard commentaries on Revelation** (Beale, Mounce, Osborne) — used for context on apocalyptic genre and symbolism.
- **Standard commentaries on Isaiah, Ezekiel, Hebrews** as needed.
- **Reference works:** ESV Concordance, standard biblical-theology references (Beale & Carson's *Commentary on the New Testament Use of the Old Testament*, etc.).

---

## 4. Explicitly out of scope (initial version)

- **Apocrypha / Deuterocanonical books.** Not in the Protestant canon; not treated as primary source.
- **Pseudepigrapha** (1 Enoch, 2 Baruch, etc.). Frequently invoked in popular angelology and visions of heaven; not canonical.
- **Patristic, medieval, and modern visionary literature.** Aquinas on the beatific vision is interpretive theology, not a source for descriptors. Dante is imaginative. Swedenborg is unreliable.
- **Modern near-death-experience literature.** Outside the source set on principle.
- **Other religious traditions** (Islamic, Jewish post-canonical, Mormon, Hindu, etc.). Not within the scope of "biblically accurate" as defined here.
- **AI training-corpus knowledge that is not in the source set.** The Q&A interface specifically refuses to draw on this.

---

## 5. Translation policy

ESV is the canonical translation for this project. Other translations are not used as primary sources for descriptors. The reasons:

- Consistency: every descriptor rests on the same translation, so wording-based interpretive questions are tractable.
- Quality: ESV is an essentially-literal translation with strong scholarly backing.
- Tractable licensing: a single rights holder to negotiate with for public distribution.

If a passage's translation is debated (e.g., Old Testament references to Sheol vs. heaven), the ESV reading is taken as default and the dispute noted in the descriptor's reviewer notes.

---

## 6. Adding a new source

A new source enters the project only via an ADR that supersedes or amends this document. The ADR must answer:

- Why is this source needed? What gap does it fill?
- What is its licensing situation?
- Does it serve as primary, secondary, or context?
- If primary or secondary, how does it interact with the existing hermeneutic policy?

This guards against scope creep into speculative or extra-biblical material.
