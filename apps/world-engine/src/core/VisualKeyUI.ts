/**
 * VisualKeyUI — the in-scene literal-vs-symbolic reading key (roadmap M3.5).
 *
 * The descriptor cards already badge confidence tiers per claim (EntityHud);
 * this makes the dataset's tier discipline legible WITHOUT opening the
 * inspector: toggle the key (K, the KEY chip, or ?key=1) and every cited
 * feature carries a floating marker — the canonical entity's name plus one
 * colored dot per confidence tier present among its descriptors — with a
 * fixed legend explaining the four tiers. Tier data comes EXCLUSIVELY from
 * the same /data/entities/ exports the cards consume; nothing is authored
 * here (the no-invented-descriptors guarantee).
 *
 * Deliberately DOM-only: no scene material changes, so the rendering
 * register — and the bloom emissive contract — is untouched whether the key
 * is on or off. Markers project each frame from the world anchors the scene
 * installs (hooks.entityKeyMarkers, built by nj/keyModel.ts). Off by
 * default; state is per-session, never persisted.
 */

import { Vector3 } from 'three';
import type { Engine } from './Engine';
import { TIER_COLOR } from './EntityHud';
import type { EntityKeyMarker, LaasHooks } from './Hooks';

/** canonical tier display order (docs/data-model.md) */
const TIER_ORDER = ['clear', 'fuzzy', 'debated', 'symbolic'] as const;

const TIER_MEANING: Record<(typeof TIER_ORDER)[number], string> = {
  clear: 'plainly affirmed — rendered literally',
  fuzzy: 'text underdetermines the form — one faithful rendering',
  debated: 'interpreters differ — follows a documented decision',
  symbolic: 'the text signals symbol — the form points to a referent',
};

/** distance fade for markers (world m): full to FADE0, gone at FADE1 */
const FADE0 = 9000;
const FADE1 = 15000;

/** minimal slice of the entity export consumed here (see EntityHud's mirror) */
type EntityJson = { name?: string; descriptors?: { tier?: string }[] };

export class VisualKeyUI {
  private on = false;
  private readonly layer: HTMLDivElement;
  private readonly legend: HTMLDivElement;
  private readonly chip: HTMLButtonElement;
  private readonly markers: { m: EntityKeyMarker; el: HTMLDivElement }[] = [];
  private raf = 0;
  private readonly v = new Vector3();
  private readonly vView = new Vector3();
  private tiersRequested = false;

  constructor(
    private readonly engine: Engine,
    private readonly hooks: LaasHooks,
    startOn: boolean,
  ) {
    this.installStyles();

    this.layer = document.createElement('div');
    this.layer.id = 'visual-key-layer';
    this.layer.hidden = true;
    for (const m of hooks.entityKeyMarkers) {
      const el = document.createElement('div');
      el.className = 'vk-m';
      el.innerHTML = `<span class="vk-dots"></span><span class="vk-name"></span>`;
      (el.querySelector('.vk-name') as HTMLSpanElement).textContent = m.label;
      this.layer.appendChild(el);
      this.markers.push({ m, el });
    }
    document.body.appendChild(this.layer);

    this.legend = document.createElement('div');
    this.legend.id = 'visual-key-legend';
    this.legend.setAttribute('role', 'note');
    this.legend.setAttribute('aria-label', 'Reading key');
    this.legend.hidden = true;
    this.legend.innerHTML =
      '<div class="vk-title">READING KEY</div>' +
      TIER_ORDER.map(
        (t) =>
          `<div class="vk-row"><i class="vk-dot" style="background:${TIER_COLOR[t]}"></i>` +
          `<strong>${t}</strong><span>${TIER_MEANING[t]}</span></div>`,
      ).join('') +
      '<div class="vk-note">markers list each feature’s descriptor tiers — ' +
      'click the feature itself for its citations</div>';
    document.body.appendChild(this.legend);

    // the chip joins the bottom-left cluster ControlsUI owns; a scene without
    // that cluster (or a future layout change) gets a standalone anchor
    this.chip = document.createElement('button');
    this.chip.type = 'button';
    this.chip.className = 'controls-chip';
    this.chip.id = 'visual-key-chip';
    this.chip.textContent = 'KEY  |  K';
    this.chip.title = 'Show the literal / symbolic reading key (K)';
    this.chip.addEventListener('click', () => this.setOn(!this.on));
    const cluster = document.getElementById('controls-cluster');
    if (cluster) cluster.appendChild(this.chip);
    else document.body.appendChild(this.chip);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyK' && !e.repeat) this.setOn(!this.on);
    });

    if (startOn) this.setOn(true);
  }

  private setOn(on: boolean): void {
    this.on = on;
    this.layer.hidden = !on;
    this.legend.hidden = !on;
    this.chip.dataset.active = String(on);
    if (on) {
      this.loadTiers();
      if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
    } else if (this.raf !== 0) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /** fetch each marked entity's canonical export once: real name + tier dots */
  private loadTiers(): void {
    if (this.tiersRequested) return;
    this.tiersRequested = true;
    const bySlug = new Map<string, Promise<EntityJson | null>>();
    for (const { m, el } of this.markers) {
      let p = bySlug.get(m.slug);
      if (!p) {
        // root-absolute like EntityHud: same-origin in prod and dev
        p = fetch(`/data/entities/${m.slug}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<EntityJson>) : null))
          .catch(() => null);
        bySlug.set(m.slug, p);
      }
      void p.then((entity) => {
        if (!entity) return; // authored fallback label stays, no dots
        const name = el.querySelector('.vk-name') as HTMLSpanElement;
        if (entity.name) name.textContent = entity.name;
        const present = TIER_ORDER.filter((t) =>
          (entity.descriptors ?? []).some((d) => d.tier === t),
        );
        (el.querySelector('.vk-dots') as HTMLSpanElement).innerHTML = present
          .map((t) => `<i class="vk-dot" style="background:${TIER_COLOR[t]}" title="${t}"></i>`)
          .join('');
      });
    }
  }

  private frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    const cam = this.engine.camera;
    for (const { m, el } of this.markers) {
      // view-space test first: projection alone folds behind-camera points in
      this.vView.set(m.p[0], m.p[1], m.p[2]).applyMatrix4(cam.matrixWorldInverse);
      if (this.vView.z > -1) {
        el.style.display = 'none';
        continue;
      }
      this.v.set(m.p[0], m.p[1], m.p[2]).project(cam);
      if (Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) {
        el.style.display = 'none';
        continue;
      }
      const d = Math.hypot(
        cam.position.x - m.p[0],
        cam.position.y - m.p[1],
        cam.position.z - m.p[2],
      );
      if (d > FADE1) {
        el.style.display = 'none';
        continue;
      }
      // honesty check via the existing pick contract: when the ray toward
      // the anchor hits a DIFFERENT entity well in front, the feature is
      // behind something from here — dim the marker instead of letting it
      // masquerade as foreground. A null pick means clear air (anchors float
      // above their volumes on purpose), so null stays fully visible; the
      // 150 m slack forgives grazing hits on a volume's near corner.
      const hit = this.hooks.entityPick?.(this.v.x, this.v.y) ?? null;
      const occluded = hit !== null && hit.slug !== m.slug && hit.t < d - 150;
      el.classList.toggle('vk-dim', occluded);
      el.style.display = '';
      const fade = d > FADE0 ? 1 - (d - FADE0) / (FADE1 - FADE0) : 1;
      el.style.opacity = String(fade * (occluded ? 0.35 : 1));
      const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = `${x.toFixed(1)}px`;
      el.style.top = `${y.toFixed(1)}px`;
    }
  };

  private installStyles(): void {
    if (document.getElementById('visual-key-styles')) return;
    const style = document.createElement('style');
    style.id = 'visual-key-styles';
    style.textContent = `
      #visual-key-layer { position:fixed; inset:0; z-index:990; pointer-events:none; overflow:hidden; }
      .vk-m { position:absolute; transform:translate(-50%,-115%); display:flex; align-items:center; gap:6px;
        padding:4px 9px; border-radius:999px; white-space:nowrap;
        border:1px solid rgba(226,211,161,.42); background:rgba(8,12,10,.72); backdrop-filter:blur(8px);
        color:#f2eedc; font:600 11px/1 system-ui,sans-serif; letter-spacing:.03em; }
      .vk-m.vk-dim { transform:translate(-50%,-115%) scale(.85); z-index:-1; }
      .vk-dots { display:flex; gap:3px; }
      .vk-dot { display:inline-block; width:8px; height:8px; border-radius:50%;
        box-shadow:0 0 0 1px rgba(0,0,0,.35); }
      #visual-key-legend { position:fixed; right:10px; bottom:10px; z-index:1090;
        width:min(300px,calc(100vw - 20px)); box-sizing:border-box; padding:12px 14px;
        border:1px solid rgba(226,211,161,.38); border-radius:14px; color:#eee9d7;
        background:linear-gradient(160deg,rgba(10,15,13,.96),rgba(18,25,20,.94));
        box-shadow:0 18px 60px rgba(0,0,0,.45); backdrop-filter:blur(18px);
        font:12px/1.45 system-ui,sans-serif; }
      #visual-key-legend .vk-title { margin-bottom:8px; color:#f4efd9;
        font:700 12px/1 ui-monospace,Menlo,monospace; letter-spacing:.12em; }
      #visual-key-legend .vk-row { display:flex; align-items:baseline; gap:7px; padding:2px 0; }
      #visual-key-legend .vk-row .vk-dot { flex:none; align-self:center; }
      #visual-key-legend .vk-row strong { flex:none; width:64px; color:#dbc987;
        font:700 11px ui-monospace,Menlo,monospace; }
      #visual-key-legend .vk-row span { color:#aaa994; }
      #visual-key-legend .vk-note { margin-top:8px; padding-top:7px;
        border-top:1px solid rgba(226,211,161,.18); color:#8f8b79; font-size:11px; }
      @media (max-width:600px) { #visual-key-legend { right:5px; bottom:5px; } }
      @media (prefers-reduced-motion:reduce) { .vk-m, #visual-key-legend { backdrop-filter:none; } }
    `;
    document.head.appendChild(style);
  }
}
