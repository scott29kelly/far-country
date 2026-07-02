/**
 * Boot overlay — "The Preparation" (also mirrored to hooks for tooling).
 *
 * The load IS the preparation (John 14:2): a fine gold line-drawing of the
 * terraced city constructs itself stroke by stroke as real world-gen progress
 * advances, standing on twelve foundation stones that ignite in Rev 21:19-20
 * order (exact gem hues from cityModel's FOUNDATION_GEMS). Light motes drift
 * through the night and follow the cursor like a lamp; a click sends a soft
 * pulse. Short ESV lines with citations rotate in the lower third.
 *
 * Contract unchanged: `set(progress, message)` and `hide()`, both mirrored to
 * `window.__laas` for the Playwright tooling. The overlay must be fully
 * invisible within ~600 ms of `hide()` (shoot.ts settles and captures soon
 * after ready). Everything here is procedural — no font files, no images
 * (engine rule: zero external assets). Honors prefers-reduced-motion.
 */

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

/** One drawn stroke of the city, revealed across a progress window. */
interface Stroke {
  el: SVGPathElement;
  glow: SVGPathElement | null;
  len: number;
  a: number;
  b: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  phase: number;
  alpha: number;
  crystal: boolean;
}

interface Pulse {
  x: number;
  y: number;
  t0: number;
}

const easeOutQuart = (t: number): number => 1 - (1 - t) ** 4;

/** City line-art: stepped holy mountain on a walled base, viewBox 560x252. */
function cityStrokes(): Array<{ d: string; cls: 'ln' | 'river'; a: number; b: number; glow: boolean }> {
  const gates = [175, 280, 385];
  const gateArcs = gates
    .map((cx) => `M ${cx - 15} 246 V 228 A 15 15 0 0 1 ${cx + 15} 228 V 246`)
    .join(' ');
  // small blind-arcade hints along the first terrace face
  let arcade = '';
  for (let x = 158; x <= 402; x += 36) {
    arcade += `M ${x} 196 v -7 a 6 6 0 0 1 12 0 v 7 `;
  }
  return [
    // wall
    { d: 'M 70 246 V 210 H 490 V 246', cls: 'ln', a: 0.04, b: 0.2, glow: true },
    // three pearl gates
    { d: gateArcs, cls: 'ln', a: 0.14, b: 0.28, glow: false },
    // terraces, base to crown
    { d: 'M 110 210 V 168 H 450 V 210', cls: 'ln', a: 0.2, b: 0.36, glow: true },
    { d: 'M 150 168 V 132 H 410 V 168', cls: 'ln', a: 0.32, b: 0.48, glow: true },
    { d: 'M 192 132 V 100 H 368 V 132', cls: 'ln', a: 0.44, b: 0.6, glow: true },
    { d: 'M 232 100 V 74 H 328 V 100', cls: 'ln', a: 0.56, b: 0.7, glow: true },
    { d: 'M 258 74 V 52 H 302 V 74', cls: 'ln', a: 0.66, b: 0.78, glow: true },
    // arcade detail
    { d: arcade, cls: 'ln', a: 0.72, b: 0.88, glow: false },
    // the river of life, summit to the centre gate
    {
      d: 'M 280 52 C 283 72 277 88 280 104 C 283 128 277 150 280 170 C 282 192 279 216 280 246',
      cls: 'river',
      a: 0.84,
      b: 0.97,
      glow: false,
    },
  ];
}

export class BootUI {
  private hooks: LaasHooks;
  private root: HTMLElement | null;
  private msg: HTMLElement | null;
  private stage: HTMLElement | null;
  private bar: HTMLElement | null;
  private baseline: HTMLElement | null;
  private dawn: HTMLElement | null;
  private beacon: SVGCircleElement | null = null;
  private beaconGlow: HTMLElement | null;
  private gemName: HTMLElement | null;
  private verseEl: HTMLElement | null;
  private citeEl: HTMLElement | null;
  private hintEl: HTMLElement | null;

  private strokes: Stroke[] = [];
  private stones: HTMLElement[] = [];
  private litCount = 0;
  private gemNameTimer = 0;

  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sprite: HTMLCanvasElement | null = null;
  private motes: Mote[] = [];
  private pulses: Pulse[] = [];
  private mouseX = -1e5;
  private mouseY = -1e5;
  private raf = 0;
  private lastT = 0;
  /** real engine progress (jumps in bursts — world-gen isn't linear in time) */
  private realP = 0;
  /** paced display progress: chases realP at a capped rate so the city's
   *  construction spans the whole wait instead of finishing in the first
   *  third and stalling at 90% */
  private displayP = 0;
  private converge = false;
  private convergeAt: [number, number] = [0, 0];
  private hidden = false;
  private reduced = false;

  private verseTimer = 0;
  private verseIdx = 0;

  private onMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };
  private onDown = (e: MouseEvent): void => {
    this.pulses.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
    if (this.hintEl) this.hintEl.style.opacity = '0';
  };
  private onResize = (): void => this.layout();

  constructor(hooks: LaasHooks) {
    this.hooks = hooks;
    this.root = document.getElementById('boot');
    this.msg = document.getElementById('boot-msg');
    this.stage = document.getElementById('boot-stage');
    this.bar = document.getElementById('boot-bar');
    this.baseline = document.getElementById('boot-baseline-fill');
    this.dawn = document.getElementById('boot-dawn');
    this.beaconGlow = document.getElementById('boot-beaconGlow');
    this.gemName = document.getElementById('boot-gemname');
    this.verseEl = document.getElementById('boot-verse');
    this.citeEl = document.getElementById('boot-cite');
    this.hintEl = document.getElementById('boot-hint');
    this.canvas = document.getElementById('boot-motes') as HTMLCanvasElement | null;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.buildCity();
    this.buildStones();
    this.startVerses();
    this.startMotes();

    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('resize', this.onResize);
    this.layout();

    if (this.hintEl && !this.reduced) {
      window.setTimeout(() => {
        if (!this.hidden && this.hintEl) this.hintEl.style.opacity = '1';
      }, 6000);
      window.setTimeout(() => {
        if (this.hintEl) this.hintEl.style.opacity = '0';
      }, 17000);
    }
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
    if (this.dawn) this.dawn.style.opacity = String(0.25 + 0.75 * p);
    this.drawCity();
    this.igniteStones();
    if (p >= 0.975) this.igniteBeacon();
  }

  hide(): void {
    this.set(1, 'ready');
    this.applyDisplay(1); // snap: remaining strokes/stones complete in the fade
    this.igniteBeacon();
    this.hidden = true;
    this.converge = true;
    if (this.beacon) {
      const r = this.beacon.getBoundingClientRect();
      this.convergeAt = [r.left + r.width / 2, r.top + r.height / 2];
    }
    if (this.root) {
      const el = this.root;
      el.style.opacity = '0';
      window.setTimeout(() => {
        el.style.display = 'none';
        this.teardown();
      }, 900);
    } else {
      this.teardown();
    }
  }

  // --- city line-art -----------------------------------------------------------

  private buildCity(): void {
    const svg = document.getElementById('boot-city');
    if (!(svg instanceof SVGSVGElement)) return;
    const NS = 'http://www.w3.org/2000/svg';
    for (const s of cityStrokes()) {
      let glow: SVGPathElement | null = null;
      if (s.glow) {
        glow = document.createElementNS(NS, 'path');
        glow.setAttribute('d', s.d);
        glow.setAttribute('class', 'glow');
        svg.appendChild(glow);
      }
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', s.d);
      p.setAttribute('class', s.cls);
      svg.appendChild(p);
      const len = p.getTotalLength();
      for (const el of glow ? [p, glow] : [p]) {
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = this.reduced ? '0' : String(len);
      }
      this.strokes.push({ el: p, glow, len, a: s.a, b: s.b });
    }
    // summit beacon
    this.beacon = document.createElementNS(NS, 'circle');
    this.beacon.setAttribute('cx', '280');
    this.beacon.setAttribute('cy', '44');
    this.beacon.setAttribute('r', '5');
    this.beacon.setAttribute('class', 'beacon');
    svg.appendChild(this.beacon);
  }

  private drawCity(): void {
    if (this.reduced) return; // fully drawn from the start
    for (const s of this.strokes) {
      const t = easeOutQuart(Math.min(1, Math.max(0, (this.displayP - s.a) / (s.b - s.a))));
      const off = String(s.len * (1 - t));
      s.el.style.strokeDashoffset = off;
      if (s.glow) s.glow.style.strokeDashoffset = off;
    }
  }

  private igniteBeacon(): void {
    if (this.beacon) this.beacon.style.opacity = '1';
    if (this.beaconGlow) this.beaconGlow.style.opacity = '1';
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
      this.verseEl.style.opacity = '0.92';
      this.citeEl.style.opacity = '0.8';
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
    window.setTimeout(() => {
      show();
      this.verseTimer = window.setTimeout(cycle, 10000);
    }, 1200);
  }

  // --- light motes -----------------------------------------------------------------

  private startMotes(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    // pre-rendered glow sprite (no per-frame shadowBlur)
    const sp = document.createElement('canvas');
    sp.width = 48;
    sp.height = 48;
    const sctx = sp.getContext('2d');
    if (sctx) {
      const g = sctx.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, 'rgba(255, 240, 200, 1)');
      g.addColorStop(0.25, 'rgba(226, 180, 92, 0.55)');
      g.addColorStop(1, 'rgba(226, 180, 92, 0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 48, 48);
    }
    this.sprite = sp;

    this.seedMotes();
    if (this.reduced) {
      this.renderMotes(0.016); // one static frame
      return;
    }
    this.lastT = performance.now();
    const tick = (now: number): void => {
      if (this.ctx === null) return;
      // world-gen starves rAF (long main-thread stalls), so wall-clock gaps
      // between frames run 0.5-2 s: pace the display on UNCLAMPED time, and
      // clamp only the mote-physics step
      const rawDt = (now - this.lastT) / 1000;
      const dt = Math.min(0.05, rawDt);
      this.lastT = now;
      // pace the display progress: ~3.5%/s base + gentle catch-up, never past
      // the real value, so the rite spans the whole wait
      if (!this.hidden && this.displayP < this.realP) {
        const next = Math.min(
          this.realP,
          this.displayP + rawDt * (0.035 + 0.05 * (this.realP - this.displayP)),
        );
        this.applyDisplay(next);
      }
      if (!document.hidden) this.renderMotes(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private seedMotes(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const n = Math.round(Math.min(190, Math.max(90, (w * h) / 11000)));
    this.motes = [];
    for (let i = 0; i < n; i++) {
      this.motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 8,
        scale: 0.35 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.55,
        crystal: Math.random() < 0.16,
      });
    }
  }

  private layout(): void {
    if (this.canvas) {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(window.innerWidth * dpr);
      this.canvas.height = Math.round(window.innerHeight * dpr);
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // park the beacon glow over the summit
    if (this.beaconGlow && this.beacon) {
      const r = this.beacon.getBoundingClientRect();
      this.beaconGlow.style.top = `${r.top + r.height / 2}px`;
      this.beaconGlow.style.left = `${r.left + r.width / 2}px`;
      this.beaconGlow.style.transform = 'translate(-50%, -50%)';
    }
  }

  private renderMotes(dt: number): void {
    const ctx = this.ctx;
    const sp = this.sprite;
    if (!ctx || !sp) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const now = performance.now() / 1000;
    const bright = 0.55 + 0.45 * this.displayP;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // the lamp: a soft halo riding the cursor
    if (this.mouseX > -1e4 && !this.converge) {
      ctx.globalAlpha = 0.1;
      ctx.drawImage(sp, this.mouseX - 60, this.mouseY - 60, 120, 120);
    }

    for (const m of this.motes) {
      // gentle wander + updraft
      m.vx += Math.sin(now * 0.45 + m.phase) * 2.4 * dt;
      m.vy += (Math.cos(now * 0.3 + m.phase * 1.7) * 1.6 - 1.2) * dt;

      if (this.converge) {
        // the lights enter the city
        const dx = this.convergeAt[0] - m.x;
        const dy = this.convergeAt[1] - m.y;
        m.vx += dx * 6 * dt;
        m.vy += dy * 6 * dt;
        m.alpha = Math.max(0, m.alpha - 0.9 * dt);
      } else if (this.mouseX > -1e4) {
        // lamp attraction: settle into a slow orbit around the cursor
        const dx = this.mouseX - m.x;
        const dy = this.mouseY - m.y;
        const d = Math.hypot(dx, dy);
        if (d < 220 && d > 1) {
          const nx = dx / d;
          const ny = dy / d;
          const pull = (d - 64) * 1.9 * dt;
          m.vx += nx * pull + -ny * 14 * dt;
          m.vy += ny * pull + nx * 14 * dt;
        }
      }

      // click pulses push outward
      for (const p of this.pulses) {
        const age = (performance.now() - p.t0) / 1000;
        if (age > 0.5) continue;
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 280) {
          const k = (1 - d / 280) * (1 - age * 2) * 240 * dt;
          m.vx += (dx / d) * k;
          m.vy += (dy / d) * k;
        }
      }

      m.vx *= 1 - 0.6 * dt;
      m.vy *= 1 - 0.6 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -30) {
        m.y = h + 20;
        m.x = Math.random() * w;
      }
      if (m.x < -30) m.x = w + 20;
      if (m.x > w + 30) m.x = -20;

      const flicker = 0.82 + 0.18 * Math.sin(now * 1.8 + m.phase * 3);
      ctx.globalAlpha = m.alpha * bright * flicker;
      const s = 22 * m.scale;
      if (m.crystal) {
        // cooler, smaller pinpoints
        ctx.globalAlpha *= 0.8;
        ctx.drawImage(sp, m.x - s * 0.35, m.y - s * 0.35, s * 0.7, s * 0.7);
      } else {
        ctx.drawImage(sp, m.x - s / 2, m.y - s / 2, s, s);
      }
    }

    // expanding pulse rings
    ctx.globalCompositeOperation = 'source-over';
    const nowMs = performance.now();
    this.pulses = this.pulses.filter((p) => nowMs - p.t0 < 1000);
    for (const p of this.pulses) {
      const age = (nowMs - p.t0) / 1000;
      const r = age * 340;
      ctx.globalAlpha = 0.22 * (1 - age);
      ctx.strokeStyle = '#e0b45c';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private teardown(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ctx = null;
    window.clearTimeout(this.verseTimer);
    window.clearTimeout(this.gemNameTimer);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('resize', this.onResize);
  }
}
