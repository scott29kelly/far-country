/**
 * ArrivalAudio — the audio first deliverable of the arrival package
 * (roadmap Operational backlog; STATUS queued item 6): a spawn-meadow
 * ambient bed (wind through grass + the river's shimmer) and a one-shot
 * south-approach score cue — a slow reverent chord swell the first time
 * the walker crosses the approach meadow toward the city.
 *
 * Everything is SYNTHESIZED in-code with the Web Audio API — zero external
 * assets (ADR 0019 exempts only the boot stills; audio stays procedural).
 * NJ-scene scoped: initArrivalAudio is called from NewJerusalemScene only,
 * so wild scenes carry no audio path at all.
 *
 * Browser autoplay policy: the graph arms on the FIRST user gesture
 * (pointerdown/keydown) and fades the bed in from silence. `?audio=0`
 * disables entirely (tooling; probes emit trusted gestures). `M` mutes.
 * Volume-shaping runs on AudioParam time constants, never on frame dt.
 */

import type { LaasHooks } from '../core/Hooks';

/** master bed level — deliberately low: presence, not soundtrack */
const BED_GAIN = 0.14;
/** the cue fires crossing this world z heading north (spawn is at 4150) */
const CUE_TRIGGER_Z = 3400;
/** bed fades toward this floor as the camera climbs (flying reads as wind-only) */
const ALT_FADE_START = 520;
const ALT_FADE_SPAN = 980;
/** river shimmer localizes to the meridian corridor's neighborhood */
const RIVER_NEAR_X = 300;
const RIVER_FADE_SPAN = 1200;

export interface ArrivalAudioHandle {
  update(): void;
}

interface BedNodes {
  ctx: AudioContext;
  master: GainNode;
  altGain: GainNode;
  riverGain: GainNode;
}

/** 2 s looped noise, one-pole smoothed toward the soft end of the spectrum. */
function makeNoiseBuffer(ac: AudioContext): AudioBuffer {
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = last * 0.94 + w * 0.06;
    d[i] = last * 3.2;
  }
  return buf;
}

function noiseSource(ac: AudioContext, buf: AudioBuffer, rate: number): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start();
  return src;
}

/** slow sine LFO driving an AudioParam around its base value */
function lfo(ac: AudioContext, hz: number, depth: number, target: AudioParam): void {
  const osc = ac.createOscillator();
  osc.frequency.value = hz;
  const g = ac.createGain();
  g.gain.value = depth;
  osc.connect(g).connect(target);
  osc.start();
}

function buildBed(ac: AudioContext): BedNodes {
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);

  // altitude-shaped section of the bed (everything except nothing, today)
  const altGain = ac.createGain();
  altGain.gain.value = 1;
  altGain.connect(master);

  const noise = makeNoiseBuffer(ac);

  // wind through meadow grass: deep-filtered noise, breathing slowly
  const windFilter = ac.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.4;
  const windGain = ac.createGain();
  windGain.gain.value = 0.42;
  noiseSource(ac, noise, 1).connect(windFilter).connect(windGain).connect(altGain);
  lfo(ac, 0.06, 140, windFilter.frequency); // gusts open the filter
  lfo(ac, 0.045, 0.16, windGain.gain); // long swells

  // the river's shimmer: a bright narrow band, localized to the meridian
  const riverFilter = ac.createBiquadFilter();
  riverFilter.type = 'bandpass';
  riverFilter.frequency.value = 1850;
  riverFilter.Q.value = 0.8;
  const riverGain = ac.createGain();
  riverGain.gain.value = 0.12;
  noiseSource(ac, noise, 1.31).connect(riverFilter).connect(riverGain).connect(altGain);
  lfo(ac, 0.11, 0.035, riverGain.gain);

  return { ctx: ac, master, altGain, riverGain };
}

/** The south-approach cue: a slow staggered D-major swell, ~20 s, once. */
function fireApproachCue(bed: BedNodes): void {
  const { ctx, master } = bed;
  const t0 = ctx.currentTime + 0.1;
  const notes: Array<{ hz: number; type: OscillatorType; peak: number }> = [
    { hz: 73.42, type: 'triangle', peak: 0.05 }, // D2
    { hz: 146.83, type: 'sine', peak: 0.09 }, // D3
    { hz: 220.0, type: 'sine', peak: 0.08 }, // A3
    { hz: 293.66, type: 'sine', peak: 0.065 }, // D4
    { hz: 369.99, type: 'sine', peak: 0.05 }, // F#4
  ];
  // the cue rides master's mute but NOT the bed's altitude shaping
  const cueGain = ctx.createGain();
  cueGain.gain.value = 1;
  cueGain.connect(master);
  notes.forEach((n, i) => {
    const start = t0 + i * 1.3;
    const osc = ctx.createOscillator();
    osc.type = n.type;
    osc.frequency.value = n.hz;
    osc.detune.value = i % 2 === 0 ? 3 : -2; // breathes like an ensemble
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(n.peak, start + 4.5);
    g.gain.setValueAtTime(n.peak, start + 8);
    g.gain.linearRampToValueAtTime(0, start + 16);
    osc.connect(g).connect(cueGain);
    osc.start(start);
    osc.stop(start + 16.5);
  });
}

export function initArrivalAudio(hooks: LaasHooks): ArrivalAudioHandle | null {
  if (new URLSearchParams(window.location.search).get('audio') === '0') return null;

  let bed: BedNodes | null = null;
  let muted = false;
  let cueFired = false;
  let prevZ: number | null = null;
  let lastAlt = 1;
  let lastRiver = 1;

  const arm = (): void => {
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('keydown', arm);
    if (bed) return;
    bed = buildBed(new AudioContext());
    void bed.ctx.resume();
    // from silence into presence over the first breaths of the meadow
    bed.master.gain.setTargetAtTime(muted ? 0 : BED_GAIN, bed.ctx.currentTime, 2.2);
    // eslint-disable-next-line no-console
    console.log('[laas] audio bed armed (M mutes)');
  };
  window.addEventListener('pointerdown', arm);
  window.addEventListener('keydown', arm);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || bed === null) return;
    muted = !muted;
    bed.master.gain.setTargetAtTime(muted ? 0 : BED_GAIN, bed.ctx.currentTime, 0.15);
    // eslint-disable-next-line no-console
    console.log(`[laas] audio ${muted ? 'muted' : 'on'} (M toggles)`);
  });

  return {
    update(): void {
      if (bed === null) return;
      const pose = hooks.getPose?.();
      if (!pose) return;
      const [x, y, z] = pose.p;

      // altitude shaping: full presence on the meadow, thinning as you fly
      const alt =
        y <= ALT_FADE_START ? 1 : Math.max(0.25, 1 - ((y - ALT_FADE_START) / ALT_FADE_SPAN) * 0.75);
      if (Math.abs(alt - lastAlt) > 0.02) {
        bed.altGain.gain.setTargetAtTime(alt, bed.ctx.currentTime, 0.8);
        lastAlt = alt;
      }
      // river shimmer localization: fades away from the meridian corridor
      const ax = Math.abs(x);
      const river =
        ax <= RIVER_NEAR_X ? 1 : Math.max(0.35, 1 - ((ax - RIVER_NEAR_X) / RIVER_FADE_SPAN) * 0.65);
      if (Math.abs(river - lastRiver) > 0.02) {
        bed.riverGain.gain.setTargetAtTime(0.12 * river, bed.ctx.currentTime, 0.8);
        lastRiver = river;
      }

      // the south-approach score cue: first northbound crossing of the
      // approach meadow (spawn 4150 → city), once per session. Gated to a
      // PLAUSIBLE approach: near meadow height and moving continuously —
      // setPose teleports (EditPanel jump buttons, probes) and high flight
      // must neither fire it nor consume it.
      const smooth = prevZ !== null && Math.abs(z - prevZ) < 40;
      if (
        !cueFired &&
        !muted &&
        smooth &&
        prevZ !== null &&
        prevZ >= CUE_TRIGGER_Z &&
        z < CUE_TRIGGER_Z &&
        y < 560
      ) {
        cueFired = true;
        fireApproachCue(bed);
        // eslint-disable-next-line no-console
        console.log('[laas] south-approach cue');
      }
      prevZ = z;
    },
  };
}
