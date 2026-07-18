/**
 * User-facing large-world navigation. The camera remains the sole movement
 * owner; this panel only exposes its existing contracts plus authored travel
 * targets and a scene-provided safe click-to-fly map.
 */

import type { Engine } from './Engine';
import { FlyCamera, type NavigationState } from './FlyCamera';
import type { LaasHooks, NavigationTarget } from './Hooks';

type TargetRow = { target: NavigationTarget; distance: HTMLSpanElement };

const WALK_METERS_PER_SECOND = 4.6;

function button(label: string, className: string, title: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.title = title;
  return el;
}

function cardinal(yaw: number): { label: string; degrees: number } {
  const degrees = ((-yaw * 180) / Math.PI + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const label = names[Math.round(degrees / 45) % names.length] ?? 'N';
  return { label, degrees };
}

export class NavigationUI {
  private readonly engine: Engine;
  private readonly fly: FlyCamera;
  private readonly hooks: LaasHooks;
  private readonly panel: HTMLDivElement;
  private readonly toggle: HTMLButtonElement;
  private readonly walkButton: HTMLButtonElement;
  private readonly flyButton: HTMLButtonElement;
  private readonly speedValue: HTMLSpanElement;
  private readonly cruiseButton: HTMLButtonElement;
  private readonly positionValue: HTMLDivElement;
  private readonly map: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D;
  private readonly targetRows: TargetRow[] = [];
  private open = false;
  private acc = 0;

  constructor(engine: Engine, fly: FlyCamera, hooks: LaasHooks) {
    this.engine = engine;
    this.fly = fly;
    this.hooks = hooks;

    this.installStyles();
    this.toggle = button('WALK  1x  |  N NAV', 'nav-toggle', 'Open navigation (N)');
    this.toggle.id = 'nav-toggle';
    this.toggle.setAttribute('aria-expanded', 'false');
    document.body.appendChild(this.toggle);

    this.panel = document.createElement('div');
    this.panel.id = 'nav-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'World navigation');
    this.panel.innerHTML = [
      '<div class="nav-head">',
      '  <div><strong>WORLD NAVIGATION</strong><span class="nav-context"></span></div>',
      '  <button type="button" class="nav-close" aria-label="Close navigation">Close</button>',
      '</div>',
      '<div class="nav-position"></div>',
      '<section><h2>Travel mode</h2><div class="nav-segment"></div></section>',
      '<section><h2>Travel speed</h2><div class="nav-speed"></div></section>',
      '<section><h2>World map</h2><canvas class="nav-map" width="600" height="360" tabindex="0" aria-label="World map. Click to fly above a location."></canvas><p class="nav-map-note">Click anywhere to fly safely above that location.</p></section>',
      '<section><h2>Quick travel</h2><div class="nav-targets"></div></section>',
      '<div class="nav-help"><strong>Move</strong> WASD · <strong>Look</strong> point mouse · <strong>Boost</strong> Shift<br><strong>Fly up/down</strong> Space / Ctrl · <strong>Speed</strong> [ / ] or wheel · <strong>Cruise</strong> C · <strong>Walk/Fly</strong> V<br><strong>Pad</strong> sticks move/look · RT/LT up/down · RB/LB speed · Start walk/fly · B dismiss</div>',
    ].join('');
    document.body.appendChild(this.panel);
    const navContext = this.required<HTMLSpanElement>('.nav-context');
    const mapContext = this.hooks.navigationMap;
    navContext.textContent = mapContext
      ? `${mapContext.title}${mapContext.citation ? ` · ${mapContext.citation}` : ''}`
      : 'Current scene';

    const segment = this.required<HTMLDivElement>('.nav-segment');
    this.walkButton = button('Walk', 'nav-mode', 'Walk on the ground (V)');
    this.flyButton = button('Fly', 'nav-mode', 'Fly freely (V)');
    segment.append(this.walkButton, this.flyButton);

    const speed = this.required<HTMLDivElement>('.nav-speed');
    const slower = button('−', 'nav-step', 'Decrease travel speed ([)');
    this.speedValue = document.createElement('span');
    this.speedValue.className = 'nav-speed-value';
    const faster = button('+', 'nav-step', 'Increase travel speed (])');
    this.cruiseButton = button('Cruise off', 'nav-cruise', 'Toggle automatic forward travel (C)');
    speed.append(slower, this.speedValue, faster, this.cruiseButton);

    this.positionValue = this.required<HTMLDivElement>('.nav-position');
    this.map = this.required<HTMLCanvasElement>('.nav-map');
    const ctx = this.map.getContext('2d');
    if (!ctx) throw new Error('Navigation map needs Canvas2D');
    this.mapCtx = ctx;

    this.buildTargets();
    this.setOpen(false);

    this.toggle.addEventListener('click', () => this.setOpen(!this.open));
    this.required<HTMLButtonElement>('.nav-close').addEventListener('click', () => this.setOpen(false));
    this.walkButton.addEventListener('click', () => this.fly.setMode('walk'));
    this.flyButton.addEventListener('click', () => this.fly.setMode('fly'));
    slower.addEventListener('click', () => this.fly.adjustTravelSpeed(-1));
    faster.addEventListener('click', () => this.fly.adjustTravelSpeed(1));
    this.cruiseButton.addEventListener('click', () => this.fly.setCruise(!this.fly.cruise));
    this.map.addEventListener('click', (event) => this.travelFromMap(event));
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyN' && !event.repeat) {
        event.preventDefault();
        this.setOpen(!this.open);
      } else if (event.code === 'Escape' && this.open) {
        this.setOpen(false);
      }
    });

    this.fly.subscribeNavigation((state) => this.renderState(state));
    this.engine.onUpdate((dt) => {
      this.acc += dt;
      if (this.acc < 0.2) return;
      this.acc = 0;
      this.renderPosition();
      this.drawMap();
    });
    this.renderPosition();
    this.drawMap();
  }

  private required<T extends Element>(selector: string): T {
    const el = this.panel.querySelector<T>(selector);
    if (!el) throw new Error(`Navigation UI missing ${selector}`);
    return el;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.style.display = open ? 'block' : 'none';
    this.toggle.setAttribute('aria-expanded', String(open));
    if (open) this.drawMap();
  }

  private renderState(state: NavigationState): void {
    this.walkButton.dataset.active = String(state.mode === 'walk');
    this.flyButton.dataset.active = String(state.mode === 'fly');
    const speed = state.mode === 'walk'
      ? `${state.walkScale}x  ${(WALK_METERS_PER_SECOND * state.walkScale).toFixed(1)} m/s`
      : `${Math.round(state.flySpeed)} m/s`;
    this.speedValue.textContent = speed;
    this.cruiseButton.textContent = state.cruise ? 'Cruise on' : 'Cruise off';
    this.cruiseButton.dataset.active = String(state.cruise);
    // PAD appears once Chrome exposes a controller (first button press)
    const pad = state.gamepad ? 'PAD  |  ' : '';
    this.toggle.textContent = `${state.mode.toUpperCase()}  ${state.mode === 'walk' ? `${state.walkScale}x` : `${Math.round(state.flySpeed)} m/s`}  |  ${pad}N NAV`;
  }

  private renderPosition(): void {
    const pose = this.fly.getPose();
    const heading = cardinal(pose.yaw);
    this.positionValue.textContent = `${heading.label} ${heading.degrees.toFixed(0)}°   X ${pose.p[0].toFixed(0)}   Y ${pose.p[1].toFixed(0)}   Z ${pose.p[2].toFixed(0)}`;
    for (const row of this.targetRows) {
      const dx = row.target.pose.p[0] - pose.p[0];
      const dz = row.target.pose.p[2] - pose.p[2];
      const meters = Math.hypot(dx, dz);
      row.distance.textContent = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`;
    }
  }

  private buildTargets(): void {
    const list = this.required<HTMLDivElement>('.nav-targets');
    if (this.hooks.navigationTargets.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'nav-empty';
      empty.textContent = 'No authored destinations in this scene.';
      list.appendChild(empty);
      return;
    }
    for (const target of this.hooks.navigationTargets) {
      const row = button('', 'nav-target', `Travel to ${target.name}`);
      const copy = document.createElement('span');
      copy.className = 'nav-target-copy';
      const name = document.createElement('strong');
      name.textContent = target.name;
      const detail = document.createElement('small');
      detail.textContent = target.citation ? `${target.detail} · ${target.citation}` : target.detail;
      copy.append(name, detail);
      const distance = document.createElement('span');
      distance.className = 'nav-distance';
      row.append(copy, distance);
      row.addEventListener('click', () => this.travelTo(target));
      list.appendChild(row);
      this.targetRows.push({ target, distance });
    }
  }

  private travelTo(target: NavigationTarget): void {
    this.fly.setPose(target.pose);
    this.fly.setMode(target.mode);
    if (target.timeOfDay !== undefined) this.hooks.setTimeOfDay?.(target.timeOfDay);
    this.setOpen(false);
  }

  private travelFromMap(event: MouseEvent): void {
    const config = this.hooks.navigationMap;
    if (!config) return;
    const rect = this.map.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const x = config.minX + (config.maxX - config.minX) * u;
    const z = config.minZ + (config.maxZ - config.minZ) * v;
    this.fly.setPose({ p: [x, config.safeFlyY(x, z), z], yaw: this.fly.yaw, pitch: -0.18 });
    this.setOpen(false);
  }

  private drawMap(): void {
    const config = this.hooks.navigationMap;
    const ctx = this.mapCtx;
    const w = this.map.width;
    const h = this.map.height;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#101a21');
    gradient.addColorStop(1, '#17221b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    if (!config) {
      ctx.fillStyle = '#aab8ae';
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Map unavailable', w / 2, h / 2);
      return;
    }

    const sx = (x: number): number => ((x - config.minX) / (config.maxX - config.minX)) * w;
    const sy = (z: number): number => ((z - config.minZ) / (config.maxZ - config.minZ)) * h;
    ctx.strokeStyle = 'rgba(226, 211, 161, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 4, 0);
      ctx.lineTo((w * i) / 4, h);
      ctx.moveTo(0, (h * i) / 4);
      ctx.lineTo(w, (h * i) / 4);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(226, 211, 161, 0.52)';
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = '#dbc987';
    ctx.font = '700 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('N', w / 2, 24);

    for (const target of this.hooks.navigationTargets) {
      const x = sx(target.pose.p[0]);
      const y = sy(target.pose.p[2]);
      if (x < 0 || x > w || y < 0 || y > h) continue;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#dbc987';
      ctx.fill();
      ctx.strokeStyle = '#182016';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const pose = this.fly.getPose();
    const px = sx(pose.p[0]);
    const py = sy(pose.p[2]);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-pose.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fillStyle = '#f8f3df';
    ctx.fill();
    ctx.restore();
  }

  private installStyles(): void {
    if (document.getElementById('nav-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'nav-ui-styles';
    style.textContent = `
      .nav-toggle { position:fixed; top:10px; right:10px; z-index:1100; border:1px solid rgba(226,211,161,.42); border-radius:999px; padding:8px 13px; color:#f2eedc; background:rgba(8,12,10,.76); backdrop-filter:blur(12px); font:700 11px/1 ui-monospace,Menlo,monospace; letter-spacing:.06em; cursor:pointer; }
      .nav-toggle:hover, .nav-toggle:focus-visible { border-color:#dbc987; outline:none; }
      #nav-panel { position:fixed; top:10px; right:10px; z-index:1150; width:min(360px,calc(100vw - 20px)); max-height:calc(100vh - 20px); overflow:auto; box-sizing:border-box; border:1px solid rgba(226,211,161,.38); border-radius:14px; padding:16px; color:#eee9d7; background:linear-gradient(160deg,rgba(10,15,13,.96),rgba(18,25,20,.94)); box-shadow:0 18px 60px rgba(0,0,0,.45); backdrop-filter:blur(18px); font:13px/1.4 system-ui,sans-serif; }
      .nav-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .nav-head strong { display:block; color:#f4efd9; font:700 13px/1.2 ui-monospace,Menlo,monospace; letter-spacing:.12em; }
      .nav-head span { display:block; margin-top:4px; color:#aaa994; font-size:11px; }
      .nav-close { border:0; padding:3px; color:#b8b8aa; background:transparent; cursor:pointer; font:12px system-ui; }
      .nav-position { margin:14px 0 4px; color:#dbc987; font:11px ui-monospace,Menlo,monospace; }
      #nav-panel section { margin-top:15px; }
      #nav-panel h2 { margin:0 0 7px; color:#aaa994; font:700 10px/1 ui-monospace,Menlo,monospace; letter-spacing:.14em; text-transform:uppercase; }
      .nav-segment { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
      .nav-mode, .nav-step, .nav-cruise { border:1px solid rgba(255,255,255,.12); border-radius:8px; min-height:36px; color:#ddd9c8; background:rgba(255,255,255,.05); cursor:pointer; }
      .nav-mode[data-active=true], .nav-cruise[data-active=true] { border-color:rgba(219,201,135,.72); color:#fff8dd; background:rgba(219,201,135,.16); }
      .nav-speed { display:grid; grid-template-columns:38px 1fr 38px; gap:5px; }
      .nav-speed-value { display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.10); border-radius:8px; color:#f4efd9; font:700 12px ui-monospace,Menlo,monospace; }
      .nav-cruise { grid-column:1/-1; }
      .nav-map { display:block; width:100%; height:auto; border-radius:9px; cursor:crosshair; }
      .nav-map:focus-visible { outline:2px solid #dbc987; outline-offset:2px; }
      .nav-map-note, .nav-empty { margin:6px 0 0; color:#8f948b; font-size:11px; }
      .nav-targets { display:grid; gap:5px; }
      .nav-target { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-width:0; box-sizing:border-box; border:1px solid rgba(255,255,255,.10); border-radius:9px; padding:9px 10px; text-align:left; color:#e7e2d1; background:rgba(255,255,255,.035); cursor:pointer; }
      .nav-target:hover, .nav-target:focus-visible { border-color:rgba(219,201,135,.62); background:rgba(219,201,135,.10); outline:none; }
      .nav-target-copy { min-width:0; }
      .nav-target-copy strong, .nav-target-copy small { display:block; }
      .nav-target-copy strong { font-size:12px; }
      .nav-target-copy small { margin-top:2px; overflow:hidden; color:#989b90; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
      .nav-distance { flex:none; color:#dbc987; font:10px ui-monospace,Menlo,monospace; }
      .nav-help { margin-top:16px; border-top:1px solid rgba(255,255,255,.09); padding-top:11px; color:#8f948b; font-size:10px; line-height:1.65; }
      .nav-help strong { color:#c8c5b7; font-weight:600; }
      @media (max-width:600px) { #nav-panel { top:5px; right:5px; width:calc(100vw - 10px); max-height:calc(100vh - 10px); } .nav-toggle { top:7px; right:7px; } }
      @media (prefers-reduced-motion:reduce) { .nav-toggle, #nav-panel { backdrop-filter:none; } }
    `;
    document.head.appendChild(style);
  }
}
