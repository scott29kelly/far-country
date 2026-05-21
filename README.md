# Far Country

> *"But they desire a better country, that is, an heavenly: wherefore God is not ashamed to be called their God: for he hath prepared for them a city."* — Hebrews 11:16

**Far Country** is a biblically accurate world model simulation of heaven.

The long-term vision is an explorable 3D environment in which a user can walk through the city of New Jerusalem and the wider biblical picture of heaven, read rich descriptions of the people, places, and things they encounter, and ask grounded questions of an AI guide that answers strictly from Scripture and trusted scholarship.

The foundation of everything else is a **ground-truth dataset of descriptors of heaven**, extracted from the Bible (ESV) and from Janet Willis's *What on Earth Is Heaven Like? A Look at God's City New Jerusalem*, with every entry traceable back to its source citation.

---

## Current phase

**Phase 0 — Documentation scaffolding.** No application code yet. The documents in `docs/` define what we're building, how we'll build it, and the interpretive principles that govern what "biblically accurate" means here.

The phased delivery plan lives in [`docs/roadmap.md`](docs/roadmap.md).

| Phase | Deliverable | Status |
| --- | --- | --- |
| 0 | Documentation scaffolding | In progress |
| 1 | Extraction pipeline + review tool + canonical dataset | Not started |
| 2 | Browse UI + grounded AI Q&A | Not started |
| 3 | Explorable 3D world (React Three Fiber) | Not started |

---

## Quick orientation

If you have 5 minutes, read in this order:

1. [`docs/vision.md`](docs/vision.md) — why this project exists.
2. [`docs/prd.md`](docs/prd.md) — what we're building, for whom, and what's out of scope.
3. [`docs/hermeneutics.md`](docs/hermeneutics.md) — the interpretive stance that defines "biblically accurate."
4. [`docs/roadmap.md`](docs/roadmap.md) — the three phases.

If you're an AI agent picking this project up mid-session, start with [`CLAUDE.md`](CLAUDE.md).

---

## How "biblically accurate" is defined

- **Sources of truth, in order:** the ESV Bible first; Janet Willis's *What on Earth Is Heaven Like?* second as a structured lens; secondary commentaries only as supporting context.
- **Hermeneutic:** conservative Protestant, literal-where-possible. Symbolic readings are flagged explicitly when text genre (apocalyptic, prophetic vision, poetry) signals them.
- **Every descriptor carries citations.** No claim about heaven enters the canonical dataset without at least one Scripture reference (and ideally a Willis reference where applicable).
- **Debated and unclear material is preserved, not discarded.** It enters a human-review queue with a confidence tier (`clear`, `fuzzy`, `debated`, `symbolic`) so it can be examined rather than silently dropped.

Full detail: [`docs/hermeneutics.md`](docs/hermeneutics.md).

---

## Repository layout (current)

```
.
├── README.md                  ← you are here
├── CLAUDE.md                  ← orientation for AI-assisted sessions
├── CONTRIBUTING.md            ← how to contribute (when the project opens up)
├── CODE_OF_CONDUCT.md
├── LICENSE                    ← placeholder; see ADR 0006
└── docs/
    ├── vision.md              ← long-form vision
    ├── prd.md                 ← product requirements
    ├── hermeneutics.md        ← interpretive principles
    ├── data-model.md          ← canonical schema
    ├── extraction-pipeline.md ← how the dataset gets built
    ├── sources.md             ← ESV, Willis, secondary references
    ├── roadmap.md             ← phased delivery
    ├── glossary.md            ← project-specific terminology
    ├── adr/                   ← architecture decision records
    └── specs/                 ← phase-specific implementation specs
```

---

## Licensing & distribution posture

This project is currently developed for **personal study use**. Public distribution will require:

- Compliance with Crossway's ESV permissions / API terms.
- Explicit permission from the rights holder of the Janet Willis book for any extended quotation or derivative summary.

See [`docs/adr/0006-source-licensing-posture.md`](docs/adr/0006-source-licensing-posture.md) and [`LICENSE`](LICENSE) for the current posture.

---

## Contributing

The project is not yet open to outside contributors — Phase 0 is a solo, AI-assisted build. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the intended workflow once it is.

---

## Name

"Far Country" is borrowed from the parable of the prodigal son (Luke 15) and from the Christian imaginative tradition (Hebrews 11, Lewis, MacDonald) of heaven as the true homeland from which we are presently exiled — the country we are made for and are travelling toward.
