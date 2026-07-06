/**
 * Procedural arrival audio — zero external assets (engine rule), pure
 * WebAudio synthesis. Three movements, one AudioContext:
 *
 *  1. The Preparation (boot): a low sustained drone (root + fifth + a slowly
 *     beating detuned octave) under an airy shimmer, swelling gently with
 *     real world-gen progress. Starts on the first user gesture (browser
 *     autoplay policy) — until then the rite is silent, which is fine.
 *  2. The meadow (after `arrive()`): the drone resolves away and the spawn
 *     meadow's ambient bed fades in — two decorrelated wind channels, a
 *     distant river hush whose gain follows the walker's distance to the
 *     approach river corridor, and sparse procedural birdsong.
 *  3. The approach (once): crossing onto the processional meadow toward the
 *     south gate swells a slow gold chord — the score cue. A softer voicing
 *     of the same chord marks the arrival itself.
 *
 * All of this is ILLUSTRATIVE ambience for the cited zone (same posture as
 * RENDERING-DECISIONS #8's campus content): no claim about heaven's
 * soundscape is being made, so nothing here needs a descriptor citation.
 *
 * Controls: `?audio=0` disables construction entirely (main.ts); `M` toggles
 * mute. Volumes are deliberately restrained — a bed, not a mix.
 */

import type { LaasHooks } from '../core/Hooks';

/** approach river corridor (world m): |x| within, z range on the south meadow */
const RIVER_HALF_X = 90;
const RIVER_Z0 = 1900;
const RIVER_Z1 = 4500;
/** south-approach cue trigger: entering the processional meadow, once */
const CUE_Z = 2950;
const CUE_HALF_X = 900;

const MASTER_LEVEL = 0.5;

/** D-lydian gold chord (Hz): D3 A3 E4 F#4 C#5 — slow attack, long release */
const CHORD = [146.83, 220.0, 329.63, 369.99, 554.37];

export class Ambience {
  private hooks: LaasHooks;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneBus: GainNode | null = null;
  private meadowBus: GainNode | null = null;
  private riverGain: GainNode | null = null;
  private muted = false;
  private arrived = false;
  private cueDone = false;
  private nextBirdAt = 0;
  private disposed = false;

  private onGesture = (): void => this.unlock();
  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyM' && !e.repeat) this.setMuted(!this.muted);
  };

  constructor(hooks: LaasHooks) {
    this.hooks = hooks;
    // arm the autoplay unlock: any click/keypress during (or after) the rite
    window.addEventListener('pointerdown', this.onGesture);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('keydown', this.onKey);
  }

  /** Idempotent: builds the graph on the first user gesture, resumes after. */
  private unlock(): void {
    if (this.disposed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
    this.master = master;

    if (this.arrived) {
      this.startMeadow();
    } else {
      this.startDrone();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, this.ctx.currentTime, 0.15);
    }
  }

  /** Looping white-noise source (2 s buffer; offset decorrelates instances). */
  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start(ctx.currentTime, Math.random() * 2);
    return src;
  }

  /** LFO helper: slow oscillator scaled into an AudioParam. */
  private lfo(ctx: AudioContext, hz: number, depth: number, param: AudioParam): void {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g).connect(param);
    osc.start();
  }

  // --- movement 1: the preparation drone -------------------------------------------

  private startDrone(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    this.droneBus = bus;

    // root + fifth + a detuned octave pair that beats at ~0.6 Hz
    const voices: Array<[number, number, OscillatorType]> = [
      [82.41, 0.5, 'sine'], // E2
      [123.47, 0.3, 'sine'], // B2
      [164.81, 0.2, 'triangle'], // E3
      [165.41, 0.16, 'triangle'], // E3 + beat
    ];
    for (const [hz, level, type] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(bus);
      osc.start();
    }
    // airy shimmer: narrow-band noise high above, breathing very slowly
    const shimmer = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300;
    bp.Q.value = 9;
    const sg = ctx.createGain();
    sg.gain.value = 0.05;
    this.lfo(ctx, 0.07, 0.03, sg.gain);
    shimmer.connect(bp).connect(sg).connect(bus);

    // fade the bed in over ~4 s; update() swells it with real progress
    bus.gain.setTargetAtTime(0.07, ctx.currentTime, 1.6);
  }

  // --- movement 2: the spawn-meadow bed ---------------------------------------------

  private startMeadow(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    this.meadowBus = bus;

    // wind: two decorrelated low-passed noise channels, panned apart, with
    // independent slow gust LFOs on filter cutoff and gain
    for (const pan of [-0.45, 0.45]) {
      const src = this.noiseSource(ctx);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 340;
      this.lfo(ctx, 0.05 + Math.random() * 0.04, 190, lp.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.055;
      this.lfo(ctx, 0.08 + Math.random() * 0.05, 0.028, g.gain);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(lp).connect(g).connect(p).connect(bus);
    }

    // the river's hush: band-passed noise; update() drives its gain by the
    // walker's distance to the approach corridor
    const rSrc = this.noiseSource(ctx);
    const rBp = ctx.createBiquadFilter();
    rBp.type = 'bandpass';
    rBp.frequency.value = 760;
    rBp.Q.value = 0.7;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    this.riverGain = rg;
    rSrc.connect(rBp).connect(rg).connect(bus);

    bus.gain.setTargetAtTime(1, ctx.currentTime, 2.2);
    this.nextBirdAt = ctx.currentTime + 2 + Math.random() * 4;
  }

  /** One procedural songbird phrase: 2-4 descending chirps, panned somewhere. */
  private birdPhrase(): void {
    const ctx = this.ctx;
    const bus = this.meadowBus;
    if (!ctx || !bus) return;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(bus);
    const n = 2 + Math.floor(Math.random() * 3);
    let t = ctx.currentTime + 0.05;
    const base = 2500 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const dur = 0.06 + Math.random() * 0.09;
      const f0 = base * (1 + Math.random() * 0.12);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * (0.8 + Math.random() * 0.12), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.022, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.04 + Math.random() * 0.12;
    }
  }

  // --- movement 3: the gold chord ---------------------------------------------------

  /** Slow-attack chord pad; `level` sets how forward it sits. */
  private playChord(level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    bus.connect(lp).connect(master);
    const t = ctx.currentTime;
    for (const hz of CHORD) {
      for (const cents of [-4, 3]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = hz;
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = 1 / (CHORD.length * 2);
        osc.connect(g).connect(bus);
        osc.start(t);
        osc.stop(t + 13);
      }
    }
    bus.gain.linearRampToValueAtTime(level, t + 2.4);
    bus.gain.setValueAtTime(level, t + 4.6);
    bus.gain.exponentialRampToValueAtTime(0.0005, t + 12.5);
  }

  // --- lifecycle --------------------------------------------------------------------

  /** The world is ready: resolve the drone into the meadow bed + a soft swell. */
  arrive(): void {
    if (this.arrived) return;
    this.arrived = true;
    const ctx = this.ctx;
    if (!ctx) return; // no gesture yet — meadow starts on unlock instead
    if (this.droneBus) {
      this.droneBus.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
      this.droneBus = null;
    }
    this.startMeadow();
    this.playChord(0.09);
  }

  /** Per-frame: drone swell with gen progress; river distance; bird scheduler;
   *  the one-shot south-approach cue. Cheap — a few compares per frame. */
  update(x: number, z: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.arrived) {
      if (this.droneBus) {
        const target = 0.07 + 0.06 * Math.min(1, Math.max(0, this.hooks.progress));
        this.droneBus.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
      }
      return;
    }
    // river hush by distance to the approach corridor
    if (this.riverGain) {
      const dx = Math.max(0, Math.abs(x) - RIVER_HALF_X);
      const dz = Math.max(0, RIVER_Z0 - z, z - RIVER_Z1);
      const d = Math.hypot(dx, dz);
      const g = 0.08 * Math.max(0, 1 - d / 520) ** 2;
      this.riverGain.gain.setTargetAtTime(g, ctx.currentTime, 0.4);
    }
    // sparse birdsong
    if (this.meadowBus && ctx.currentTime >= this.nextBirdAt) {
      this.birdPhrase();
      this.nextBirdAt = ctx.currentTime + 3 + Math.random() * 9;
    }
    // the score cue: first crossing onto the processional approach
    if (!this.cueDone && z < CUE_Z && Math.abs(x) < CUE_HALF_X) {
      this.cueDone = true;
      this.playChord(0.16);
    }
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointerdown', this.onGesture);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('keydown', this.onKey);
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
