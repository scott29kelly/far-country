/**
 * Boot overlay — "The Arrival" (also mirrored to hooks for tooling).
 *
 * The wait shows the destination: full-bleed stills of the REAL world
 * (self-produced engine captures, ADR 0019) drift under slow Ken Burns
 * motion while short ESV lines with citations rotate above the twelve
 * foundation stones (Rev 21:19-20 order, exact gem hues from cityModel's
 * FOUNDATION_GEMS) that ignite as generation advances. The carousel's
 * motion lives on CSS transform/opacity — compositor-threaded, so it keeps
 * easing straight through the 0.5-2 s main-thread stalls world-gen causes;
 * slide SWAPS are timed on wall-clock (never dt) and merely arrive late.
 *
 * Contract unchanged: `set(progress, message)` and `hide()`, both mirrored
 * to `window.__laas`; `#boot` keeps its id (Diagnostics force-hides by id).
 * `hide()` runs a staged arrival for humans (light veil, then the world is
 * simply there — ~2.7 s); `?rite=0` (the tooling default via laasUrl) and
 * prefers-reduced-motion keep the fast path: fully invisible in ~600 ms.
 * Stills appear only for ?scene=newjerusalem with the rite on — wild-scene
 * boots never fetch NJ imagery. First ~8% of boot touches no GPU here:
 * everything is DOM/CSS.
 */

import { BOOT_STILLS } from '../nj/bootStills';
import { FOUNDATION_GEMS } from '../nj/cityModel';
import type { LaasHooks } from './Hooks';

/** Ceremonial stage line keyed off the raw engine progress message. */
const STAGES: Array<[RegExp, string]> = [
  [/ready/i, 'the place is prepared'],
  [/jerusalem|city|allot/i, 'preparing the city'],
  [/veg|scatter|tree|forest|grass|plant/i, 'planting the garden'],
  [/water|river|lake|hydro|caust/i, 'tracing the rivers'],
  [/cloud|sky|atmo|froxel|fog/i, 'spreading the heavens'],
  [/\bgi\b|probe|irradiance/i, 'gathering the light'],
  [/synth|height|erosion|terrain|carve|relax|biome|tile|land/i, 'forming the land'],
  [/webgpu|renderer|probing|shader|pipeline/i, 'kindling the light'],
];

/** Short exact ESV excerpts (personal-study posture: brief, always cited). */
const VERSES: Array<[string, string]> = [
  ['“I go to prepare a place for you.”', 'John 14:2 · ESV'],
  ['“For he has prepared for them a city.”', 'Hebrews 11:16 · ESV'],
  ['“Behold, the dwelling place of God is with man.”', 'Revelation 21:3 · ESV'],
  [
    '“The city has no need of sun or moon to shine on it, for the glory of God gives it light.”',
    'Revelation 21:23 · ESV',
  ],
  ['“…showed me the holy city Jerusalem coming down out of heaven from God.”', 'Revelation 21:10 · ESV'],
  ['“Night will be no more… for the Lord God will be their light.”', 'Revelation 22:5 · ESV'],
];

/** wall-clock milliseconds each still holds before the next crossfade */
const SLIDE_MS = 9500;

export class BootUI {
  private hooks: LaasHooks;
  private root: HTMLElement | null;
  private msg: HTMLElement | null;
  private stage: HTMLElement | null;
  private bar: HTMLElement | null;
  private baseline: HTMLElement | null;
  private gemName: HTMLElement | null;
  private verseEl: HTMLElement | null;
  private citeEl: HTMLElement | null;
  private stillsHost: HTMLElement | null;
  private captionEl: HTMLElement | null;

  private stones: HTMLElement[] = [];
  private litCount = 0;
  private gemNameTimer = 0;

  /** double-buffered still layers: back layer loads, then crossfades over */
  private layers: [HTMLDivElement, HTMLDivElement] | null = null;
  private front = 0;
  private slideIdx = -1;
  private slideTimer = 0;
  private loaded = new Set<number>();

  private raf = 0;
  private lastT = 0;
  /** real engine progress (jumps in bursts — world-gen isn't linear in time) */
  private realP = 0;
  /** paced display progress: chases realP at a capped rate so the stones'
   *  ignition spans the whole wait instead of finishing in the first third
   *  and stalling at 90% */
  private displayP = 0;
  private hidden = false;
  private reduced = false;
  /** rite=0 (tooling): no stills, fast hide — deterministic screenshots */
  private rite = true;

  private verseTimer = 0;
  private verseIdx = 0;

  constructor(hooks: LaasHooks) {
    this.hooks = hooks;
    this.root = document.getElementById('boot');
    this.msg = document.getElementById('boot-msg');
    this.stage = document.getElementById('boot-stage');
    this.bar = document.getElementById('boot-bar');
    this.baseline = document.getElementById('boot-baseline-fill');
    this.gemName = document.getElementById('boot-gemname');
    this.verseEl = document.getElementById('boot-verse');
    this.citeEl = document.getElementById('boot-cite');
    this.stillsHost = document.getElementById('boot-stills');
    this.captionEl = document.getElementById('boot-caption');
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const q = new URLSearchParams(window.location.search);
    this.rite = q.get('rite') !== '0';

    this.buildStones();
    this.startVerses();
    if (this.rite && q.get('scene') === 'newjerusalem') this.initStills();
    if (!this.reduced) this.startPacing();
  }

  set(progress: number, message: string): void {
    this.hooks.progress = progress;
    this.hooks.progressMsg = message;
    this.realP = Math.min(1, Math.max(0, progress));
    if (this.msg) this.msg.textContent = message;
    if (this.bar) this.bar.style.width = `${Math.round(progress * 100)}%`;
    if (this.stage) {
      const line = STAGES.find(([re]) => re.test(message));
      if (line && this.stage.textContent !== line[1]) this.stage.textContent = line[1];
    }
    // reduced motion has no rAF pacing loop — apply directly
    if (this.reduced) this.applyDisplay(this.realP);
  }

  /** Drive every progress-bound visual from the paced display value. */
  private applyDisplay(p: number): void {
    this.displayP = p;
    if (this.baseline) this.baseline.style.width = `${Math.round(p * 100)}%`;
    this.igniteStones();
  }

  hide(): void {
    this.set(1, 'ready');
    this.applyDisplay(1); // snap: remaining stones complete in the fade
    this.hidden = true;
    window.clearTimeout(this.slideTimer);
    const el = this.root;
    if (!el) {
      this.teardown();
      return;
    }
    if (this.rite && !this.reduced) {
      // the arrival: the journey freezes, light opens, and when it clears
      // the world is simply there (compositor-only — no GPU dependence)
      el.classList.add('arriving'); // veil in, 0.9 s; Ken Burns pauses
      window.setTimeout(() => {
        el.style.opacity = '0'; // 1.8 s dissolve through the light
      }, 750);
      window.setTimeout(() => {
        el.style.display = 'none';
        this.teardown();
      }, 2700);
    } else {
      // tooling / reduced-motion: fully invisible well under 1 s
      el.classList.add('fast');
      el.style.opacity = '0';
      window.setTimeout(() => {
        el.style.display = 'none';
        this.teardown();
      }, 600);
    }
  }

  // --- stills carousel (ADR 0019 — the real world, drifting) -------------------

  private initStills(): void {
    if (!this.stillsHost || BOOT_STILLS.length === 0) return;
    const mk = (kb: 'kbA' | 'kbB'): HTMLDivElement => {
      const d = document.createElement('div');
      d.className = this.reduced ? 'still' : `still ${kb}`;
      this.stillsHost?.appendChild(d);
      return d;
    };
    this.layers = [mk('kbA'), mk('kbB')];

    // preload everything up front (DOM images, no GPU); first slide shows as
    // soon as its decode lands — with a fallback tick so a single failed
    // first image can never leave the rite on the empty night gradient
    BOOT_STILLS.forEach((s, i) => {
      const img = new Image();
      img.onload = () => {
        this.loaded.add(i);
        if (i === 0 && this.slideIdx < 0) this.advance();
      };
      img.src = s.url;
    });
    this.slideTimer = window.setTimeout(this.advance, 2500);
  }

  /** Crossfade to the next LOADED still (skipping failed/slow decodes);
   *  retry shortly if none is ready yet. Timed on wall-clock — gen stalls
   *  only make a slide hold longer. Idempotent: clears any pending tick. */
  private advance = (): void => {
    window.clearTimeout(this.slideTimer);
    if (this.hidden || !this.layers) return;
    let next = -1;
    for (let k = 1; k <= BOOT_STILLS.length; k++) {
      const cand = (this.slideIdx + k) % BOOT_STILLS.length;
      if (this.loaded.has(cand) && cand !== this.slideIdx) {
        next = cand;
        break;
      }
    }
    if (next < 0) {
      this.slideTimer = window.setTimeout(this.advance, 1500);
      return;
    }
    const still = BOOT_STILLS[next];
    if (!still) return;
    const back = this.layers[1 - this.front];
    const frontEl = this.layers[this.front];
    if (!back || !frontEl) return;
    back.style.backgroundImage = `url("${still.url}")`;
    back.classList.add('on');
    frontEl.classList.remove('on');
    this.front = 1 - this.front;
    this.slideIdx = next;
    if (this.captionEl) {
      this.captionEl.textContent = still.caption;
      this.captionEl.classList.add('on');
    }
    this.slideTimer = window.setTimeout(this.advance, SLIDE_MS);
  };

  // --- paced display progress ---------------------------------------------------

  private startPacing(): void {
    this.lastT = performance.now();
    const tick = (now: number): void => {
      if (this.hidden) return;
      // world-gen starves rAF (long main-thread stalls), so wall-clock gaps
      // between frames run 0.5-2 s: pace on UNCLAMPED elapsed time so the
      // display keeps up with reality, never on frame count
      const rawDt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (this.displayP < this.realP) {
        const next = Math.min(
          this.realP,
          this.displayP + rawDt * (0.035 + 0.05 * (this.realP - this.displayP)),
        );
        this.applyDisplay(next);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // --- twelve foundation stones -------------------------------------------------

  private buildStones(): void {
    const row = document.getElementById('boot-stones');
    if (!row) return;
    for (let i = 0; i < FOUNDATION_GEMS.length; i++) {
      const d = document.createElement('div');
      d.className = 'stone';
      row.appendChild(d);
      this.stones.push(d);
    }
  }

  private igniteStones(): void {
    const gems = FOUNDATION_GEMS;
    while (this.litCount < gems.length) {
      const threshold = 0.06 + (this.litCount * (0.9 - 0.06)) / (gems.length - 1);
      if (this.displayP < threshold) break;
      const gem = gems[this.litCount];
      const el = this.stones[this.litCount];
      if (el && gem) {
        el.classList.add('lit');
        el.style.background = gem.color;
        el.style.boxShadow = `0 0 14px 1px ${gem.color}66`;
        if (this.gemName) {
          this.gemName.textContent = gem.name;
          this.gemName.style.opacity = '1';
          window.clearTimeout(this.gemNameTimer);
          this.gemNameTimer = window.setTimeout(() => {
            if (this.gemName) this.gemName.style.opacity = '0';
          }, 2000);
        }
      }
      this.litCount++;
    }
  }

  // --- the word -------------------------------------------------------------------

  private startVerses(): void {
    const show = (): void => {
      const v = VERSES[this.verseIdx % VERSES.length];
      if (!v || !this.verseEl || !this.citeEl) return;
      this.verseEl.textContent = v[0];
      this.citeEl.textContent = v[1];
      this.verseEl.style.opacity = '0.94';
      this.citeEl.style.opacity = '0.82';
      this.verseIdx++;
    };
    const cycle = (): void => {
      if (this.hidden) return;
      if (this.verseEl) this.verseEl.style.opacity = '0';
      if (this.citeEl) this.citeEl.style.opacity = '0';
      this.verseTimer = window.setTimeout(() => {
        show();
        this.verseTimer = window.setTimeout(cycle, 10000);
      }, 1000);
    };
    this.verseTimer = window.setTimeout(() => {
      show();
      this.verseTimer = window.setTimeout(cycle, 10000);
    }, 1200);
  }

  private teardown(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.clearTimeout(this.verseTimer);
    window.clearTimeout(this.gemNameTimer);
    window.clearTimeout(this.slideTimer);
  }
}
