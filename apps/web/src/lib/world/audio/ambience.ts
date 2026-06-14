"use client";

/**
 * Procedural ambience for the world — fully synthesized in the Web Audio API so
 * the experience stays self-contained (no audio files). Three layers, mixed by
 * the listener's position:
 *
 *   - water  — looping filtered noise (the river of life, Rev 22:1); loudest
 *              near the cascade meridian (x≈0).
 *   - wind   — soft low-passed noise, a constant gentle presence.
 *   - pad    — a detuned harmonic "worship" chord through a reverb, that SWELLS
 *              as you approach the throne at the summit (Rev 5 — the hosts sing).
 *
 * A real choir can't be synthesized convincingly here, so the worship layer is
 * an ethereal harmonic pad. The audio context is created/resumed on a user
 * gesture (the "Enter the city" click) per browser autoplay policy.
 */

type Nodes = {
  water: GainNode;
  pad: GainNode;
  master: GainNode;
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A synthetic decaying-noise impulse response — a cheap spacious reverb tail. */
function impulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}

/** A warm open chord (D major with octaves) for the worship pad. */
const PAD_NOTES = [73.42, 110.0, 146.83, 220.0, 293.66, 369.99];

const SUMMIT_Y = 84;
const MASTER_VOL = 0.85;

class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private nodes: Nodes | null = null;
  muted = false;

  /** Create (once) and resume the context — must be called from a user gesture. */
  start(): void {
    if (!this.ctx) this.build();
    void this.ctx?.resume();
  }

  private build(): void {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER_VOL;
    master.connect(ctx.destination);

    // Spacious reverb (shared by water + pad).
    const verb = ctx.createConvolver();
    verb.buffer = impulseResponse(ctx, 3.5, 2.4);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.45;
    verb.connect(verbGain).connect(master);

    // --- Water -------------------------------------------------------------
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = noiseBuffer(ctx, 2);
    waterSrc.loop = true;
    const waterBP = ctx.createBiquadFilter();
    waterBP.type = "bandpass";
    waterBP.frequency.value = 800;
    waterBP.Q.value = 0.6;
    const waterHP = ctx.createBiquadFilter();
    waterHP.type = "highpass";
    waterHP.frequency.value = 320;
    const water = ctx.createGain();
    water.gain.value = 0;
    waterSrc.connect(waterBP).connect(waterHP).connect(water);
    water.connect(master);
    water.connect(verb);
    waterSrc.start();
    const wLfo = ctx.createOscillator();
    wLfo.frequency.value = 0.2;
    const wLfoG = ctx.createGain();
    wLfoG.gain.value = 220;
    wLfo.connect(wLfoG).connect(waterBP.frequency);
    wLfo.start();

    // --- Wind (constant gentle presence) -----------------------------------
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer(ctx, 2);
    windSrc.loop = true;
    const windLP = ctx.createBiquadFilter();
    windLP.type = "lowpass";
    windLP.frequency.value = 480;
    const wind = ctx.createGain();
    wind.gain.value = 0.05;
    windSrc.connect(windLP).connect(wind).connect(master);
    windSrc.start();
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const windLfoG = ctx.createGain();
    windLfoG.gain.value = 260;
    windLfo.connect(windLfoG).connect(windLP.frequency);
    windLfo.start();

    // --- Worship pad -------------------------------------------------------
    const pad = ctx.createGain();
    pad.gain.value = 0;
    pad.connect(master);
    pad.connect(verb);
    // A breathing tremolo sits BETWEEN the chord and the swell gain, so when the
    // swell (pad) is 0 the layer is fully silent (the LFO can't leak it).
    const breath = ctx.createGain();
    breath.gain.value = 0.85;
    const breathLfo = ctx.createOscillator();
    breathLfo.frequency.value = 0.12;
    const breathLfoG = ctx.createGain();
    breathLfoG.gain.value = 0.13;
    breathLfo.connect(breathLfoG).connect(breath.gain);
    breathLfo.start();
    const padLP = ctx.createBiquadFilter();
    padLP.type = "lowpass";
    padLP.frequency.value = 1700;
    padLP.connect(breath).connect(pad);
    for (const f of PAD_NOTES) {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.1 / PAD_NOTES.length;
        o.connect(g).connect(padLP);
        o.start();
      }
    }

    this.nodes = { water, pad, master };
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.nodes && this.ctx) {
      this.nodes.master.gain.setTargetAtTime(
        m ? 0 : MASTER_VOL,
        this.ctx.currentTime,
        0.1,
      );
    }
  }

  /** Mix the layers for the listener at (x, y, z). Called each frame, throttled. */
  update(x: number, y: number, z: number): void {
    if (!this.ctx || !this.nodes) return;
    const t = this.ctx.currentTime;

    // Worship swells toward the throne at the summit.
    const dThrone = Math.hypot(x, y - SUMMIT_Y, z);
    const padTarget = clamp01(1 - dThrone / 175) ** 1.5 * 0.95;
    this.nodes.pad.gain.setTargetAtTime(padTarget, t, 0.6);

    // Water is loudest near the cascade meridian (x≈0) within the city's depth.
    const zClamped = Math.min(100, Math.max(0, z));
    const dRiver = Math.hypot(x, z - zClamped);
    const waterTarget = clamp01(1 - dRiver / 42) * 0.5;
    this.nodes.water.gain.setTargetAtTime(waterTarget, t, 0.4);
  }
}

export const ambience = new AmbienceEngine();
