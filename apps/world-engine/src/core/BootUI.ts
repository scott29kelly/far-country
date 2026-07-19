/**
 * Boot overlay — "The Descent" (also mirrored to hooks for tooling).
 *
 * The load IS the arrival (Rev 21:2, 10): a painterly night sky in which the
 * luminous terraced city comes down out of heaven as real world-gen progress
 * advances — emerging from a sea of drifting clouds, its glory halo and rays
 * swelling, until at 100% it rests on the meadow horizon. Twelve foundation
 * stones ignite in Rev 21:19-20 order (exact gem hues from cityModel's
 * FOUNDATION_GEMS). Light motes drift through the night and follow the cursor
 * like a lamp; a click sends a soft pulse. Short ESV lines with citations
 * rotate in the lower third.
 *
 * Contract: `set(progress, message)` and `hide()`, both mirrored to
 * `window.__laas` for the Playwright tooling. `hide()` runs a staged dissolve
 * (text bows out, a glory veil blooms and settles like eyes adjusting, the
 * night fades) taking ~1.8 s — tooling passes `?rite=0` (launch.ts sets it by
 * default) for the fast path, which is fully invisible within ~350 ms.
 *
 * CINEMATIC BACKDROP (2026-07-19, user directive): the painted descent is
 * superseded by a vendored 12 s generated film (Seedance 2.0 via Higgsfield,
 * /intro/nj-descent.mp4 in apps/web/public — same generate-offline-and-vendor
 * posture as the planned audio layer). The film fades in over the painting on
 * `canplay`; the painting keeps running underneath as the standing fallback
 * (missing file, codec failure, offline dev) and stays the only path for
 * `?rite=0` (probes must not fetch 18 MB) and prefers-reduced-motion. The
 * motes/lamp canvas keeps compositing OVER the film — its drifting embers
 * match the film's own. All overlays (verses, stones, stage lines, dissolve)
 * are unchanged. No claim about heaven is made by the film beyond what the
 * painting already claimed: illustrative art for the cited Rev 21:2/21:10
 * descent.
 *
 * Honors prefers-reduced-motion (static painting, fast
 * hide). The first ~8% of boot touches no GPU: this file is DOM + Canvas2D
 * only. World-gen starves rAF (0.5-2 s main-thread stalls), so all pacing is
 * wall-clock, never per-frame dt.
 */

import { FOUNDATION_GEMS } from '../nj/cityModel';
import { easeInOutCubic } from './Easing';
import type { LaasHooks } from './Hooks';
import { hashString, Rng } from './Seed';

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
  [
    '“…coming down out of heaven from God, prepared as a bride adorned for her husband.”',
    'Revelation 21:2 · ESV',
  ],
  ['“For he has prepared for them a city.”', 'Hebrews 11:16 · ESV'],
  ['“Behold, the dwelling place of God is with man.”', 'Revelation 21:3 · ESV'],
  [
    '“The city has no need of sun or moon to shine on it, for the glory of God gives it light.”',
    'Revelation 21:23 · ESV',
  ],
  ['“…showed me the holy city Jerusalem coming down out of heaven from God.”', 'Revelation 21:10 · ESV'],
  ['“Night will be no more… for the Lord God will be their light.”', 'Revelation 22:5 · ESV'],
];

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

interface Cloud {
  /** sprite variant index */
  v: number;
  /** anchor x as a fraction of viewport width (drifts) */
  fx: number;
  /** anchor y as a fraction of viewport height */
  fy: number;
  scale: number;
  /** drift speed, viewport-width fractions per second */
  speed: number;
  alpha: number;
  /** 0 = behind the city, 1 = in front */
  layer: 0 | 1;
}

interface BrightStar {
  fx: number;
  fy: number;
  r: number;
  phase: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** City tier table, sprite-local units (viewBox descends from the old rite). */
const TIERS: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
  { x0: 70, x1: 490, y0: 210, y1: 246 }, // wall
  { x0: 110, x1: 450, y0: 168, y1: 210 },
  { x0: 150, x1: 410, y0: 132, y1: 168 },
  { x0: 192, x1: 368, y0: 100, y1: 132 },
  { x0: 232, x1: 328, y0: 74, y1: 100 },
  { x0: 258, x1: 302, y0: 52, y1: 74 },
];
/** sprite canvas geometry: city drawing inset so halo/bloom never clips */
const SPR_W = 720;
const SPR_H = 400;
const SPR_OX = 80; // city-local x + SPR_OX = sprite x
const SPR_OY = 96; // city-local y + SPR_OY = sprite y
const SUMMIT = { x: 280 + SPR_OX, y: 44 + SPR_OY };
const WALL_BASE_Y = 246 + SPR_OY;
/** viewport fraction of the horizon the wall base seats on at p=1 — just
 *  above the stones row (74%), so the city lands between ridge and rite */
const HORIZON_F = 0.725;
/** how far the wall base sinks behind the meadow's back ridge (CSS px):
 *  deep enough that the base never floats on sky at the ridge's dips,
 *  shallow enough that the gates stay readable at its rises */
const RIDGE_SINK = 12;

export class BootUI {
  private hooks: LaasHooks;
  private root: HTMLElement | null;
  private msg: HTMLElement | null;
  private stage: HTMLElement | null;
  private baseline: HTMLElement | null;
  private veil: HTMLElement | null;
  private gemName: HTMLElement | null;
  private verseEl: HTMLElement | null;
  private citeEl: HTMLElement | null;
  private hintEl: HTMLElement | null;

  private stones: HTMLElement[] = [];
  private litCount = 0;
  private gemNameTimer = 0;

  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  /** true once the film is decodable — drawScene then paints only motes/lamp */
  private videoActive = false;

  // pre-rendered layers (built once; star/meadow layers rebuilt on resize)
  private citySprite: HTMLCanvasElement | null = null;
  private haloSprite: HTMLCanvasElement | null = null;
  private raySprite: HTMLCanvasElement | null = null;
  private moteSprite: HTMLCanvasElement | null = null;
  private glowSprite: HTMLCanvasElement | null = null;
  private cloudSprites: HTMLCanvasElement[] = [];
  private starsFar: HTMLCanvasElement | null = null;
  private starsNear: HTMLCanvasElement | null = null;
  private meadow: HTMLCanvasElement | null = null;
  private brightStars: BrightStar[] = [];
  private clouds: Cloud[] = [];

  private motes: Mote[] = [];
  private pulses: Pulse[] = [];
  private mouseX = -1e5;
  private mouseY = -1e5;
  private raf = 0;
  private lastT = 0;
  /** real engine progress (jumps in bursts — world-gen isn't linear in time) */
  private realP = 0;
  /** paced display progress: chases realP at a capped rate so the descent
   *  spans the whole wait instead of finishing in the first third and
   *  stalling at 90% */
  private displayP = 0;
  private hidden = false;
  private reduced = false;
  /** ?rite=0 — tooling bypass: no pacing, near-instant hide() */
  private riteOff = false;

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
  private resizeTimer = 0;
  private onResize = (): void => {
    // the main canvas tracks the viewport immediately (no smeared frame);
    // the star/meadow layer repaints are the expensive part — debounce them
    this.layoutCanvas();
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.layout(), 150);
  };

  /** `riteOn` comes from LaasParams.rite (main.ts) — the harness passes its
   *  own parseParams().rite so ?rite=0 behaves identically there. */
  constructor(hooks: LaasHooks, riteOn: boolean) {
    this.hooks = hooks;
    this.root = document.getElementById('boot');
    this.msg = document.getElementById('boot-msg');
    this.stage = document.getElementById('boot-stage');
    this.baseline = document.getElementById('boot-baseline-fill');
    this.veil = document.getElementById('boot-veil');
    this.gemName = document.getElementById('boot-gemname');
    this.verseEl = document.getElementById('boot-verse');
    this.citeEl = document.getElementById('boot-cite');
    this.hintEl = document.getElementById('boot-hint');
    this.canvas = document.getElementById('boot-scene') as HTMLCanvasElement | null;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.riteOff = !riteOn;

    this.buildSprites();
    this.buildStones();
    this.startVerses();
    this.startScene();
    if (!this.riteOff && !this.reduced) this.installVideo();

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
    if (this.stage) {
      const line = STAGES.find(([re]) => re.test(message));
      if (line && this.stage.textContent !== line[1]) this.stage.textContent = line[1];
    }
    // reduced motion / tooling bypass have no rAF pacing loop — apply directly
    if (this.reduced || this.riteOff) this.applyDisplay(this.realP);
  }

  /** Drive every progress-bound visual from the paced display value. */
  private applyDisplay(p: number): void {
    this.displayP = p;
    if (this.baseline) this.baseline.style.width = `${Math.round(p * 100)}%`;
    this.igniteStones();
    if (this.reduced) this.drawScene(0);
  }

  /**
   * Staged dissolve (the arrival is where the bar is felt): the text bows
   * out, the glory veil blooms over ~0.7 s and settles like eyes adjusting
   * to the city's light, the night fades to the live world underneath, and
   * the motes stream into the summit. `?rite=0` / reduced motion take the
   * fast path: fully invisible within ~350 ms (shoot.ts capture contract).
   */
  hide(): void {
    if (this.hidden) return;
    this.set(1, 'ready');
    this.applyDisplay(1); // snap: remaining stones/descent complete in the fade
    this.hidden = true;
    const el = this.root;
    if (!el) {
      this.teardown();
      return;
    }
    el.classList.add('leaving');
    // the stage timers below never need cancelling: teardown only ever runs
    // FROM the last of them (hide() is one-way and guarded by `hidden`)
    if (this.riteOff || this.reduced) {
      el.style.transitionDuration = '0.22s';
      el.style.opacity = '0';
      window.setTimeout(() => {
        el.style.display = 'none';
        this.teardown();
      }, 320);
      return;
    }
    // stage 1: glory veil blooms while the night still holds
    window.setTimeout(() => {
      if (this.veil) this.veil.style.opacity = '0.94';
    }, 120);
    // stage 2: the night lifts — the world shows through the settling veil
    window.setTimeout(() => {
      el.style.opacity = '0';
      if (this.veil) {
        this.veil.style.transition = 'opacity 1.1s ease-out';
        this.veil.style.opacity = '0';
      }
    }, 720);
    // stage 3: gone
    window.setTimeout(() => {
      el.style.display = 'none';
      this.teardown();
    }, 1850);
  }

  /** The vendored descent film. Fail-soft by design: until `canplay` the
   *  painting is what the user sees, and any error simply leaves it there. */
  private installVideo(): void {
    const root = this.root;
    if (!root || !this.canvas) return;
    const v = document.createElement('video');
    v.id = 'boot-video';
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.src = '/intro/nj-descent.mp4';
    // the immediate play() can race the load ("interrupted by a new load
    // request") — retry whenever the film becomes decodable and, as the
    // final guarantee, on the first user gesture (the rite always gets one:
    // the same click that unlocks the AudioContext)
    const safePlay = (): void => {
      if (this.video === v && v.paused) void v.play().catch(() => undefined);
    };
    v.addEventListener('canplay', () => {
      if (this.hidden) return;
      this.videoActive = true;
      v.style.opacity = '1';
      safePlay();
    });
    v.addEventListener('error', () => {
      this.videoActive = false;
      v.remove();
      this.video = null;
    });
    window.addEventListener('pointerdown', safePlay, { once: true });
    window.addEventListener('keydown', safePlay, { once: true });
    root.insertBefore(v, this.canvas); // under the canvas: motes/lamp stay on top
    this.video = v;
    safePlay();
  }

  // --- pre-rendered painting layers ---------------------------------------------

  private buildSprites(): void {
    this.citySprite = this.paintCity();
    this.haloSprite = this.paintHalo();
    this.raySprite = this.paintRays();
    this.moteSprite = this.paintMoteSprite();
    this.glowSprite = this.paintGlow();
    this.cloudSprites = [this.paintCloud(11), this.paintCloud(37), this.paintCloud(71)];
    // cloud field: a loose deck below centre — back layer behind the city,
    // a few forward wisps the city descends through
    const CLOUD_SEED: Array<[number, number, number, number, number, 0 | 1]> = [
      // fx,  fy,   scale, speed,  alpha, layer
      [0.12, 0.52, 1.55, 0.0042, 0.5, 0],
      [0.46, 0.57, 2.1, 0.003, 0.62, 0],
      [0.82, 0.5, 1.7, 0.0052, 0.48, 0],
      [0.3, 0.47, 1.2, 0.006, 0.34, 0],
      [0.68, 0.44, 1.05, 0.0048, 0.3, 0],
      [0.22, 0.62, 1.9, 0.0072, 0.55, 1],
      [0.62, 0.66, 2.3, 0.0058, 0.6, 1],
      [0.92, 0.6, 1.5, 0.008, 0.44, 1],
    ];
    this.clouds = CLOUD_SEED.map(([fx, fy, scale, speed, alpha, layer], i) => ({
      v: i % this.cloudSprites.length,
      fx,
      fy,
      scale,
      speed,
      alpha,
      layer,
    }));
  }

  /** The city itself: painterly gold terraces, lit windows, gates, the river. */
  private paintCity(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = SPR_W;
    c.height = SPR_H;
    const g = c.getContext('2d');
    if (!g) return c;

    const X = (v: number): number => v + SPR_OX;
    const Y = (v: number): number => v + SPR_OY;

    // faces, base wall to crown — each a vertical gold gradient with a bright
    // cornice lip and soft side shading so the terraces read as coursed mass
    for (let i = 0; i < TIERS.length; i++) {
      const t = TIERS[i];
      if (!t) continue;
      const x0 = X(t.x0);
      const x1 = X(t.x1);
      const y0 = Y(t.y0);
      const y1 = Y(t.y1);
      const w = x1 - x0;
      const face = g.createLinearGradient(0, y0, 0, y1);
      const k = i / (TIERS.length - 1); // crown tiers run brighter (Rev 21:18 "pure gold, like clear glass")
      face.addColorStop(0, `rgba(${232 + 14 * k}, ${196 + 26 * k}, ${118 + 52 * k}, ${0.92})`);
      face.addColorStop(0.55, 'rgba(178, 132, 58, 0.88)');
      face.addColorStop(1, 'rgba(96, 68, 30, 0.9)');
      g.fillStyle = face;
      g.fillRect(x0, y0, w, y1 - y0);
      // cornice lip
      g.fillStyle = 'rgba(255, 233, 178, 0.95)';
      g.fillRect(x0, y0, w, 1.6);
      g.fillStyle = 'rgba(255, 233, 178, 0.22)';
      g.fillRect(x0, y0 + 1.6, w, 3);
      // side shading for volume
      const side = Math.max(10, w * 0.075);
      const shL = g.createLinearGradient(x0, 0, x0 + side, 0);
      shL.addColorStop(0, 'rgba(30, 22, 10, 0.42)');
      shL.addColorStop(1, 'rgba(30, 22, 10, 0)');
      g.fillStyle = shL;
      g.fillRect(x0, y0, side, y1 - y0);
      const shR = g.createLinearGradient(x1 - side, 0, x1, 0);
      shR.addColorStop(0, 'rgba(30, 22, 10, 0)');
      shR.addColorStop(1, 'rgba(30, 22, 10, 0.42)');
      g.fillStyle = shR;
      g.fillRect(x1 - side, y0, side, y1 - y0);
      // shadow cast onto the tier below's setback
      if (i > 0) {
        const below = TIERS[i - 1];
        if (below) {
          g.fillStyle = 'rgba(14, 10, 4, 0.3)';
          g.fillRect(X(below.x0), y1, X(below.x1) - X(below.x0), 3.5);
        }
      }
    }

    // window glints: sparse warm points on every face (skip the base wall)
    for (let i = 1; i < TIERS.length; i++) {
      const t = TIERS[i];
      if (!t) continue;
      const rows = Math.max(2, Math.round((t.y1 - t.y0) / 13));
      const cols = Math.max(6, Math.round((t.x1 - t.x0) / 17));
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          if (Math.random() < 0.42) continue;
          const wx = X(t.x0) + (col + 0.5 + (Math.random() - 0.5) * 0.5) * ((t.x1 - t.x0) / cols);
          const wy = Y(t.y0) + (r + 0.62 + (Math.random() - 0.5) * 0.3) * ((t.y1 - t.y0) / rows);
          const a = 0.35 + Math.random() * 0.55;
          g.fillStyle = `rgba(255, 240, 200, ${a})`;
          const s = 1 + Math.random() * 1.2;
          g.fillRect(wx, wy, s, s * 1.4);
        }
      }
    }

    // three pearl gates on the south wall (Rev 21:21 "each of the gates a single pearl")
    for (const cx of [175, 280, 385]) {
      const gx = X(cx);
      const gy = Y(246);
      const gw = 15;
      const gh = 18;
      const pearl = g.createLinearGradient(0, gy - gh - gw, 0, gy);
      pearl.addColorStop(0, 'rgba(240, 236, 226, 0.95)');
      pearl.addColorStop(1, 'rgba(174, 168, 154, 0.9)');
      g.fillStyle = pearl;
      g.beginPath();
      g.moveTo(gx - gw, gy);
      g.lineTo(gx - gw, gy - gh);
      g.arc(gx, gy - gh, gw, Math.PI, 0);
      g.lineTo(gx + gw, gy);
      g.closePath();
      g.fill();
      // recessed opening with warm light spilling out
      const open = g.createLinearGradient(0, gy - gh - gw * 0.6, 0, gy);
      open.addColorStop(0, 'rgba(255, 244, 214, 0.98)');
      open.addColorStop(1, 'rgba(217, 164, 65, 0.85)');
      g.fillStyle = open;
      g.beginPath();
      g.moveTo(gx - gw * 0.55, gy);
      g.lineTo(gx - gw * 0.55, gy - gh);
      g.arc(gx, gy - gh, gw * 0.55, Math.PI, 0);
      g.lineTo(gx + gw * 0.55, gy);
      g.closePath();
      g.fill();
    }

    // twelve-gem foundation course girdling the wall base (Rev 21:19-20 order)
    const fx0 = X(70);
    const fx1 = X(490);
    const seg = (fx1 - fx0) / FOUNDATION_GEMS.length;
    for (let i = 0; i < FOUNDATION_GEMS.length; i++) {
      const gem = FOUNDATION_GEMS[i];
      if (!gem) continue;
      g.fillStyle = gem.color;
      g.globalAlpha = 0.9;
      g.fillRect(fx0 + i * seg + 1, WALL_BASE_Y, seg - 2, 4);
    }
    g.globalAlpha = 1;

    // the river of life, summit to the centre gate (Rev 22:1)
    g.strokeStyle = 'rgba(223, 234, 240, 0.28)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    const river = (): void => {
      g.beginPath();
      g.moveTo(SUMMIT.x, Y(52));
      g.bezierCurveTo(X(283), Y(88), X(277), Y(126), X(280), Y(160));
      g.bezierCurveTo(X(283), Y(196), X(279), Y(224), X(280), Y(246));
      g.stroke();
    };
    river();
    g.strokeStyle = 'rgba(223, 234, 240, 0.85)';
    g.lineWidth = 2;
    river();

    // summit glory (throne + glory-light conflated, aniconic per ADR 0010)
    const orb = g.createRadialGradient(SUMMIT.x, SUMMIT.y, 0, SUMMIT.x, SUMMIT.y, 30);
    orb.addColorStop(0, 'rgba(255, 250, 235, 1)');
    orb.addColorStop(0.22, 'rgba(255, 240, 200, 0.9)');
    orb.addColorStop(0.5, 'rgba(240, 200, 110, 0.35)');
    orb.addColorStop(1, 'rgba(240, 200, 110, 0)');
    g.fillStyle = orb;
    g.fillRect(SUMMIT.x - 30, SUMMIT.y - 30, 60, 60);

    return c;
  }

  private paintHalo(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    if (!g) return c;
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(244, 214, 138, 0.4)');
    grad.addColorStop(0.35, 'rgba(226, 180, 92, 0.16)');
    grad.addColorStop(0.7, 'rgba(217, 164, 65, 0.05)');
    grad.addColorStop(1, 'rgba(217, 164, 65, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    return c;
  }

  /** Soft god-ray fan, drawn radiating from the sprite centre. */
  private paintRays(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 640;
    const g = c.getContext('2d');
    if (!g) return c;
    g.translate(320, 320);
    const N = 7;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + 0.35;
      const spread = 0.055 + (i % 3) * 0.02;
      const len = 250 + (i % 4) * 60;
      const grad = g.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
      grad.addColorStop(0, 'rgba(255, 240, 200, 0.16)');
      grad.addColorStop(0.5, 'rgba(244, 214, 138, 0.05)');
      grad.addColorStop(1, 'rgba(244, 214, 138, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, len, ang - spread, ang + spread);
      g.closePath();
      g.fill();
    }
    return c;
  }

  /** The city's light pooling on the meadow — drawn per frame via drawImage
   *  + globalAlpha instead of a per-frame createRadialGradient. */
  private paintGlow(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    if (!g) return c;
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(226, 186, 106, 1)');
    grad.addColorStop(1, 'rgba(226, 186, 106, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    return c;
  }

  private paintMoteSprite(): HTMLCanvasElement {
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
    return sp;
  }

  /** One lumpy night-cloud bank (seed varies the blob layout per variant). */
  private paintCloud(seed: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 440;
    c.height = 170;
    const g = c.getContext('2d');
    if (!g) return c;
    // deterministic per-variant layout (engine Rng, same idiom as the stars)
    const rng = new Rng(seed);
    const rnd = (): number => rng.float();
    const blobs = 9;
    for (let i = 0; i < blobs; i++) {
      const bx = 60 + rnd() * 320;
      const by = 70 + rnd() * 55;
      const br = 34 + rnd() * 52;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, 'rgba(38, 46, 74, 0.5)');
      grad.addColorStop(0.6, 'rgba(28, 34, 56, 0.3)');
      grad.addColorStop(1, 'rgba(24, 29, 48, 0)');
      g.fillStyle = grad;
      g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // moonless rim light: the city's gold catches the deck's upper edge
    for (let i = 0; i < 5; i++) {
      const bx = 90 + rnd() * 260;
      const by = 52 + rnd() * 28;
      const br = 26 + rnd() * 30;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, 'rgba(226, 186, 106, 0.1)');
      grad.addColorStop(1, 'rgba(226, 186, 106, 0)');
      g.fillStyle = grad;
      g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    return c;
  }

  /** Viewport-sized layers: star fields + the meadow silhouette. Seeded from
   *  fixed Rng streams (fractional positions) so a resize rebuild keeps every
   *  star where it was instead of reshuffling the sky. */
  private buildViewportLayers(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mk = (seed: string, count: number, maxR: number, alpha: number): HTMLCanvasElement => {
      const rng = new Rng(hashString(seed));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (!g) return c;
      for (let i = 0; i < count; i++) {
        const x = rng.float() * w;
        const y = rng.float() * h * 0.82;
        const r = 0.4 + rng.float() * maxR;
        const warm = rng.chance(0.3);
        const a = alpha * (0.35 + rng.float() * 0.65);
        g.fillStyle = warm ? `rgba(238, 222, 188, ${a})` : `rgba(206, 218, 238, ${a})`;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };
    this.starsFar = mk('boot:stars:far', Math.round((w * h) / 6200), 0.7, 0.5);
    this.starsNear = mk('boot:stars:near', Math.round((w * h) / 16000), 1.15, 0.8);
    this.brightStars = [];
    const rng = new Rng(hashString('boot:stars:bright'));
    const nb = 26;
    for (let i = 0; i < nb; i++) {
      this.brightStars.push({
        fx: rng.float(),
        fy: rng.float() * 0.7,
        r: 0.9 + rng.float() * 1.4,
        phase: rng.float() * Math.PI * 2,
      });
    }

    // meadow: a calm distant back ridge the city seats behind (its crest
    // rides RIDGE_SINK px over the wall-base horizon, weaving only a few px,
    // so at p=1 the base sits in grass, never on sky) plus a freer rolling
    // silhouette closing the frame's base
    const m = document.createElement('canvas');
    const mh = Math.max(120, Math.round(h * 0.34));
    m.width = w;
    m.height = mh;
    const g = m.getContext('2d');
    if (g) {
      const hill = (yBase: number, amp: number, k1: number, k2: number, color: string): void => {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, mh);
        for (let x = 0; x <= w; x += 8) {
          const y =
            yBase - amp * Math.sin((x / w) * Math.PI * k1 + 0.7) - amp * 0.5 * Math.sin((x / w) * Math.PI * k2 + 2.1);
          g.lineTo(x, y);
        }
        g.lineTo(w, mh);
        g.closePath();
        g.fill();
      };
      const ridgeC = h * HORIZON_F - RIDGE_SINK - (h - mh); // canvas coords
      hill(ridgeC, h * 0.006, 2.2, 5.1, 'rgba(10, 13, 21, 0.9)');
      hill(mh * 0.62, mh * 0.07, 3.1, 7.3, 'rgba(7, 9, 15, 0.96)');
    }
    this.meadow = m;
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

  // --- the painting ----------------------------------------------------------------

  private startScene(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.seedMotes();
    if (this.reduced) {
      this.drawScene(0); // one static frame; set() redraws on progress
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
      // the real value, so the descent spans the whole wait
      if (!this.hidden && this.displayP < this.realP) {
        const next = Math.min(
          this.realP,
          this.displayP + rawDt * (0.035 + 0.05 * (this.realP - this.displayP)),
        );
        this.applyDisplay(next);
      }
      if (!document.hidden) this.drawScene(dt);
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

  private layoutCanvas(): void {
    if (this.canvas) {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(window.innerWidth * dpr);
      this.canvas.height = Math.round(window.innerHeight * dpr);
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // reduced motion has no rAF loop — repaint now (old layers stretch for
    // the debounce window; layout() follows with the rebuilt ones)
    if (this.reduced) this.drawScene(0);
  }

  private layout(): void {
    this.layoutCanvas();
    this.buildViewportLayers();
    if (this.reduced) this.drawScene(0);
  }

  /** City placement for the current descent progress, in CSS pixels. */
  private cityRect(): { x: number; y: number; w: number; h: number; scale: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const e = easeInOutCubic(this.displayP);
    const drawW = Math.min(680, vw * 0.76) * (0.82 + 0.18 * e);
    const scale = drawW / SPR_W;
    const drawH = SPR_H * scale;
    const horizonY = vh * HORIZON_F;
    // rest: wall base seated on the horizon; start: city high in the night
    const restY = horizonY - WALL_BASE_Y * scale;
    const startY = -drawH * 1.08; // fully above the frame — only its glow precedes it
    const y = startY + (restY - startY) * e;
    return { x: (vw - drawW) / 2, y, w: drawW, h: drawH, scale };
  }

  private drawScene(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const now = this.reduced ? 0 : performance.now() / 1000;
    const p = this.displayP;

    ctx.clearRect(0, 0, w, h);

    // film backdrop active: the canvas contributes only motes + lamp + pulses;
    // the dissolve's converge point is the film city's summit beacon
    if (this.videoActive) {
      this.renderMotes(dt, now, [w * 0.5, h * 0.3]);
      return;
    }

    // --- stars (two drifting parallax layers + a few twinklers) ---------------
    if (this.starsFar) {
      const off = (now * 1.1) % w;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.starsFar, -off, 0);
      ctx.drawImage(this.starsFar, w - off, 0);
    }
    if (this.starsNear) {
      const off = (now * 2.6) % w;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.starsNear, -off, 0);
      ctx.drawImage(this.starsNear, w - off, 0);
    }
    for (const s of this.brightStars) {
      const tw = 0.45 + 0.55 * Math.sin(now * 1.7 + s.phase) ** 2;
      ctx.globalAlpha = 0.75 * tw;
      ctx.fillStyle = 'rgba(224, 232, 246, 1)';
      ctx.beginPath();
      ctx.arc(s.fx * w, s.fy * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const city = this.cityRect();
    const summitX = city.x + SUMMIT.x * city.scale;
    const summitY = city.y + SUMMIT.y * city.scale;
    // light leads the descent: halo/rays swell with how far the city has come
    const desc = easeInOutCubic(p);

    // --- glory halo + god rays behind the city -------------------------------
    if (this.haloSprite) {
      const r = (city.w * 0.62 + city.w * 0.5 * p) | 0;
      ctx.globalAlpha = 0.2 + 0.8 * desc;
      ctx.drawImage(this.haloSprite, summitX - r, summitY - r, r * 2, r * 2);
    }
    if (this.raySprite && !this.reduced) {
      const r = city.w * 0.75;
      ctx.save();
      ctx.translate(summitX, summitY);
      ctx.rotate(now * 0.022);
      ctx.globalAlpha = 0.08 + 0.72 * desc;
      ctx.drawImage(this.raySprite, -r, -r, r * 2, r * 2);
      ctx.restore();
    } else if (this.raySprite) {
      const r = city.w * 0.75;
      ctx.globalAlpha = 0.08 + 0.72 * desc;
      ctx.drawImage(this.raySprite, summitX - r, summitY - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    // --- cloud deck (back), the city, cloud deck (front) ----------------------
    const cloudLayer = (layer: 0 | 1): void => {
      for (const cl of this.clouds) {
        if (cl.layer !== layer) continue;
        const sp = this.cloudSprites[cl.v];
        if (!sp) continue;
        const cw = sp.width * cl.scale * (w / 1400);
        const ch = sp.height * cl.scale * (w / 1400);
        const cx = ((((cl.fx + now * cl.speed) % 1) + 1) % 1) * (w + cw * 1.6) - cw * 1.3;
        const cy = cl.fy * h - ch / 2;
        // the deck thins as the city settles through it
        ctx.globalAlpha = cl.alpha * (layer === 1 ? 1 - 0.45 * p : 1);
        ctx.drawImage(sp, cx, cy, cw, ch);
      }
      ctx.globalAlpha = 1;
    };
    cloudLayer(0);

    if (this.citySprite) {
      ctx.globalAlpha = 0.3 + 0.7 * clamp01(p * 1.6);
      ctx.drawImage(this.citySprite, city.x, city.y, city.w, city.h);
      ctx.globalAlpha = 1;
    }

    cloudLayer(1);

    // --- meadow silhouette + the city's light pooling on it -------------------
    if (this.meadow) {
      ctx.drawImage(this.meadow, 0, h - this.meadow.height);
      const glowA = 0.14 * p;
      if (glowA > 0.005 && this.glowSprite) {
        // pool the light on the meadow under the seated base; crop the
        // sprite's upper half so no glow spills back onto the sky
        const r = w * 0.3;
        const cy = h * 0.74;
        const cut = Math.max(cy - r, h * 0.6);
        const sy = ((cut - (cy - r)) / (2 * r)) * 512;
        ctx.globalAlpha = glowA;
        ctx.drawImage(this.glowSprite, 0, sy, 512, 512 - sy, w / 2 - r, cut, r * 2, cy + r - cut);
        ctx.globalAlpha = 1;
      }
    }

    // --- light motes -----------------------------------------------------------
    this.renderMotes(dt, now, [summitX, summitY]);
  }

  private renderMotes(dt: number, now: number, convergeAt: [number, number]): void {
    const ctx = this.ctx;
    const sp = this.moteSprite;
    if (!ctx || !sp) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bright = 0.55 + 0.45 * this.displayP;
    const nowMs = performance.now();

    ctx.globalCompositeOperation = 'lighter';

    // the lamp: a soft halo riding the cursor
    if (this.mouseX > -1e4 && !this.hidden) {
      ctx.globalAlpha = 0.1;
      ctx.drawImage(sp, this.mouseX - 60, this.mouseY - 60, 120, 120);
    }

    for (const m of this.motes) {
      // gentle wander + updraft
      m.vx += Math.sin(now * 0.45 + m.phase) * 2.4 * dt;
      m.vy += (Math.cos(now * 0.3 + m.phase * 1.7) * 1.6 - 1.2) * dt;

      if (this.hidden) {
        // the lights enter the city (the dissolve is under way)
        const dx = convergeAt[0] - m.x;
        const dy = convergeAt[1] - m.y;
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
      for (const pl of this.pulses) {
        const age = (nowMs - pl.t0) / 1000;
        if (age > 0.5) continue;
        const dx = m.x - pl.x;
        const dy = m.y - pl.y;
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
    if (this.pulses.length > 0) {
      this.pulses = this.pulses.filter((pl) => nowMs - pl.t0 < 1000);
      for (const pl of this.pulses) {
        const age = (nowMs - pl.t0) / 1000;
        const r = age * 340;
        ctx.globalAlpha = 0.22 * (1 - age);
        ctx.strokeStyle = '#e0b45c';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private teardown(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ctx = null;
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load(); // release the decoder + network buffers
      this.video.remove();
      this.video = null;
    }
    window.clearTimeout(this.verseTimer);
    window.clearTimeout(this.gemNameTimer);
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('resize', this.onResize);
  }
}
