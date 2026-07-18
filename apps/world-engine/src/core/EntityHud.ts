/**
 * EntityHud — the citation-grounded descriptor card (roadmap M3.4).
 *
 * Click a rendered structure and the geometry footnotes itself: the card
 * shows the canonical entity's descriptors with confidence-tier badges,
 * Scripture/Willis citations, and the symbolic referent where the tier
 * demands one. Content comes EXCLUSIVELY from the same per-entity JSON
 * exports the apps/web browse UI consumes (`/data/entities/<slug>.json`,
 * root-absolute: the engine is served same-origin under /laas/ in prod and
 * the standalone dev server maps apps/web/public via vite publicDir) — no
 * descriptor text is authored here.
 *
 * Interaction contract: canvas click → hooks.entityPick (scene-owned; null
 * on scenes without cited content) → card. Click on empty world, the ✕, or
 * Escape dismisses. Mouse-steer is mousemove-based, so a stationary click
 * never turns the camera; the card is a body-level sibling of the canvas
 * (hovering it suspends steering naturally via the canvas mouseleave).
 *
 * The card is display-only chrome, never load-bearing for tooling: probes
 * drive picking through `window.__laas.entityPick` directly.
 */

import type { Engine } from './Engine';
import type { LaasHooks } from './Hooks';

/**
 * Minimal mirror of the canonical export shapes consumed here — source of
 * truth: apps/web/src/lib/data/types.ts (hand-mirrored like nj/cityModel's
 * tables; keep in sync when the schema version moves).
 */
export interface EntityCitation {
  source_type: string;
  book?: string | null;
  chapter?: number | null;
  verse_start?: number | null;
  verse_end?: number | null;
  willis_chapter?: string | null;
  willis_page_start?: number | null;
  willis_page_end?: number | null;
  secondary_work?: string | null;
}

export interface EntityDescriptor {
  statement: string;
  tier: string;
  symbolic_referent?: string | null;
  citations: EntityCitation[];
}

export interface EntityExport {
  id: string;
  name: string;
  descriptors: EntityDescriptor[];
}

/** citation display grammar — ported from the legacy DescriptorHud */
export function formatCitation(c: EntityCitation): string {
  if (c.source_type === 'scripture' && c.book && c.chapter != null) {
    if (c.verse_start != null) {
      const end = c.verse_end != null && c.verse_end !== c.verse_start ? `-${c.verse_end}` : '';
      return `${c.book} ${c.chapter}:${c.verse_start}${end}`;
    }
    return `${c.book} ${c.chapter}`;
  }
  if (c.source_type === 'willis' && c.willis_chapter) {
    if (c.willis_page_start != null) {
      const end =
        c.willis_page_end != null && c.willis_page_end !== c.willis_page_start
          ? `-${c.willis_page_end}`
          : '';
      return `Willis ${c.willis_chapter} p.${c.willis_page_start}${end}`;
    }
    return `Willis ${c.willis_chapter}`;
  }
  if (c.source_type === 'secondary' && c.secondary_work) return c.secondary_work;
  return c.source_type;
}

const MAX_CARDS = 3;
const TIER_COLOR: Record<string, string> = {
  clear: '#3f9e63',
  fuzzy: '#b8862d',
  debated: '#b0562d',
  symbolic: '#7a5bbb',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class EntityHud {
  private root: HTMLDivElement;
  private cache = new Map<string, Promise<EntityExport | null>>();
  private activeSlug: string | null = null;

  constructor(
    private engine: Engine,
    private hooks: LaasHooks,
  ) {
    this.installStyles();
    this.root = document.createElement('div');
    this.root.id = 'entity-hud';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Entity descriptors');
    this.root.hidden = true;
    document.body.appendChild(this.root);

    engine.renderer.domElement.addEventListener('click', this.onClick);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.hide();
    });
  }

  private onClick = (e: MouseEvent): void => {
    const pick = this.hooks.entityPick;
    if (!pick) return;
    const el = this.engine.renderer.domElement;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const hit = pick(nx, ny);
    if (!hit) {
      this.hide();
      return;
    }
    this.show(hit.slug, hit.label);
  };

  private show(slug: string, label: string): void {
    this.activeSlug = slug;
    this.root.hidden = false;
    this.renderShell(label, `<div class="eh-loading">loading descriptors…</div>`);
    void this.load(slug).then((entity) => {
      if (this.activeSlug !== slug || this.root.hidden) return;
      if (!entity) {
        this.renderShell(
          label,
          `<div class="eh-loading">descriptor data unavailable (entity: ${esc(slug)})</div>`,
        );
        return;
      }
      this.renderEntity(label, entity);
    });
  }

  private load(slug: string): Promise<EntityExport | null> {
    let p = this.cache.get(slug);
    if (!p) {
      // root-absolute on purpose: /laas/-based relative paths would 404 (see
      // the module header); same-origin with apps/web in prod and dev
      p = fetch(`/data/entities/${slug}.json`)
        .then((res) => (res.ok ? (res.json() as Promise<EntityExport>) : null))
        .catch(() => null);
      this.cache.set(slug, p);
    }
    return p;
  }

  private renderEntity(label: string, entity: EntityExport): void {
    const cards = entity.descriptors.slice(0, MAX_CARDS).map((d) => {
      const tierColor = TIER_COLOR[d.tier] ?? '#666';
      const cites = d.citations
        .map((c) => `<span class="eh-cite">${esc(formatCitation(c))}</span>`)
        .join('');
      const referent =
        d.tier === 'symbolic' && d.symbolic_referent
          ? `<div class="eh-referent">referent: ${esc(d.symbolic_referent)}</div>`
          : '';
      return `<div class="eh-card">
        <div class="eh-cardhead"><span class="eh-tier" style="background:${tierColor}">${esc(d.tier)}</span>${cites}</div>
        <div class="eh-statement">${esc(d.statement)}</div>
        ${referent}
      </div>`;
    });
    const more =
      entity.descriptors.length > MAX_CARDS
        ? `<div class="eh-more">+${entity.descriptors.length - MAX_CARDS} more on the entity page</div>`
        : '';
    this.renderShell(
      label,
      `<div class="eh-name">${esc(entity.name)}</div>${cards.join('')}${more}`,
      entity.id,
    );
  }

  private renderShell(label: string, body: string, slug?: string): void {
    const link = slug
      ? `<a class="eh-open" href="/entities/${esc(slug)}" target="_blank" rel="noopener">open ↗</a>`
      : '';
    this.root.innerHTML = `
      <div class="eh-head">
        <span class="eh-label">${esc(label)}</span>
        ${link}
        <button class="eh-close" title="Dismiss (Esc)" aria-label="Dismiss">✕</button>
      </div>
      ${body}`;
    this.root.querySelector('.eh-close')?.addEventListener('click', () => this.hide());
  }

  hide(): void {
    this.activeSlug = null;
    this.root.hidden = true;
  }

  private installStyles(): void {
    if (document.getElementById('entity-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'entity-hud-styles';
    style.textContent = `
#entity-hud{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
  width:min(430px,calc(100vw - 24px));z-index:1050;
  background:rgba(14,13,10,0.88);backdrop-filter:blur(6px);
  border:1px solid rgba(212,180,110,0.35);border-radius:10px;
  color:#e8e2d4;font:13px/1.45 system-ui,sans-serif;padding:10px 12px;}
#entity-hud .eh-head{display:flex;align-items:center;gap:8px;}
#entity-hud .eh-label{font-size:11px;letter-spacing:0.08em;text-transform:uppercase;
  color:#d4b46e;flex:1;}
#entity-hud .eh-open{color:#9fc4e8;text-decoration:none;font-size:12px;}
#entity-hud .eh-open:hover{text-decoration:underline;}
#entity-hud .eh-close{background:none;border:none;color:#a89f8c;cursor:pointer;
  font-size:13px;padding:2px 4px;}
#entity-hud .eh-close:hover{color:#fff;}
#entity-hud .eh-name{font-size:15px;font-weight:600;margin:4px 0 6px;}
#entity-hud .eh-card{border-top:1px solid rgba(212,180,110,0.18);padding:7px 0 5px;}
#entity-hud .eh-cardhead{display:flex;flex-wrap:wrap;gap:5px;align-items:center;
  margin-bottom:4px;}
#entity-hud .eh-tier{font-size:10px;letter-spacing:0.06em;text-transform:uppercase;
  color:#fff;border-radius:4px;padding:1px 6px;}
#entity-hud .eh-cite{font-family:ui-monospace,monospace;font-size:11px;
  border:1px solid rgba(159,196,232,0.4);color:#9fc4e8;border-radius:4px;
  padding:0 5px;}
#entity-hud .eh-statement{color:#efeadd;}
#entity-hud .eh-referent{font-style:italic;color:#b9aed6;font-size:12px;margin-top:3px;}
#entity-hud .eh-more,#entity-hud .eh-loading{color:#a89f8c;font-size:12px;margin-top:5px;}
@media (prefers-reduced-motion: no-preference){
  #entity-hud{transition:opacity 120ms ease;}
}`;
    document.head.appendChild(style);
  }
}

export function installEntityHud(engine: Engine, hooks: LaasHooks): EntityHud {
  return new EntityHud(engine, hooks);
}
