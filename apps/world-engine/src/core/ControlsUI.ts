/**
 * On-screen controls help + sound toggle (user request: the keys are
 * forgettable and the M mute was undiscoverable). Two persistent chips in the
 * bottom-left corner, styled after NavigationUI's nav-toggle:
 *
 *   KEYS | H      — toggles a compact card listing every navigation key
 *   SOUND ON | M  — mirrors and drives Ambience's mute (state persisted there)
 *
 * The camera/audio remain the sole owners of their state; this panel only
 * exposes their existing contracts (FlyCamera bindings, Ambience.setMuted).
 * The sound chip is omitted when the scene runs without an Ambience
 * (?audio=0, wild scenes).
 */

import type { Ambience } from '../audio/Ambience';

const KEY_ROWS: Array<[string, string]> = [
  ['Look around', 'point the mouse (no click)'],
  ['Move', 'W A S D'],
  ['Go faster', 'hold Shift'],
  ['Jump  (walking)', 'Space'],
  ['Rise / descend  (flying)', 'Space / Ctrl'],
  ['Switch walk / fly', 'V'],
  ['Cruise forward', 'C   (Esc stops)'],
  ['Travel speed', '[  ]  or mouse wheel'],
  ['Navigation panel + map', 'N'],
  ['Literal / symbolic key', 'K'],
  ['Mute sound', 'M'],
  ['Show / hide this card', 'H'],
];

export class ControlsUI {
  private readonly card: HTMLDivElement;
  private readonly keysChip: HTMLButtonElement;
  private open = false;

  constructor(ambience: Ambience | null) {
    this.installStyles();

    const cluster = document.createElement('div');
    cluster.id = 'controls-cluster';

    this.keysChip = this.chip('KEYS  |  H', 'Show the keyboard controls (H)');
    this.keysChip.addEventListener('click', () => this.setOpen(!this.open));
    cluster.appendChild(this.keysChip);

    if (ambience) {
      const sound = this.chip('', 'Mute or unmute the sound (M)');
      sound.addEventListener('click', () => ambience.setMuted(!ambience.isMuted));
      cluster.appendChild(sound);
      const paint = (muted: boolean): void => {
        sound.textContent = muted ? 'SOUND OFF  |  M' : 'SOUND ON  |  M';
        sound.dataset.muted = String(muted);
      };
      ambience.onMuteChange = paint;
      paint(ambience.isMuted);
    }

    document.body.appendChild(cluster);

    this.card = document.createElement('div');
    this.card.id = 'controls-card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-label', 'Keyboard controls');
    this.card.innerHTML =
      '<div class="controls-title">CONTROLS</div>' +
      KEY_ROWS.map(
        ([what, how]) =>
          `<div class="controls-row"><span>${what}</span><strong>${how}</strong></div>`,
      ).join('');
    document.body.appendChild(this.card);
    this.setOpen(false);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat) this.setOpen(!this.open);
      else if (e.code === 'Escape' && this.open) this.setOpen(false);
    });
  }

  private chip(label: string, title: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'controls-chip';
    el.textContent = label;
    el.title = title;
    return el;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.card.style.display = open ? 'block' : 'none';
    this.keysChip.dataset.active = String(open);
  }

  private installStyles(): void {
    if (document.getElementById('controls-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'controls-ui-styles';
    style.textContent = `
      #controls-cluster { position:fixed; left:10px; bottom:10px; z-index:1100; display:flex; gap:6px; }
      .controls-chip { border:1px solid rgba(226,211,161,.42); border-radius:999px; padding:8px 13px; color:#f2eedc; background:rgba(8,12,10,.76); backdrop-filter:blur(12px); font:700 11px/1 ui-monospace,Menlo,monospace; letter-spacing:.06em; cursor:pointer; }
      .controls-chip:hover, .controls-chip:focus-visible { border-color:#dbc987; outline:none; }
      .controls-chip[data-active=true] { border-color:rgba(219,201,135,.72); color:#fff8dd; background:rgba(219,201,135,.16); }
      .controls-chip[data-muted=true] { color:#b8b8aa; }
      #controls-card { position:fixed; left:10px; bottom:52px; z-index:1150; width:min(320px,calc(100vw - 20px)); box-sizing:border-box; border:1px solid rgba(226,211,161,.38); border-radius:14px; padding:14px 16px; color:#eee9d7; background:linear-gradient(160deg,rgba(10,15,13,.96),rgba(18,25,20,.94)); box-shadow:0 18px 60px rgba(0,0,0,.45); backdrop-filter:blur(18px); font:12px/1.5 system-ui,sans-serif; }
      .controls-title { margin-bottom:9px; color:#f4efd9; font:700 12px/1 ui-monospace,Menlo,monospace; letter-spacing:.12em; }
      .controls-row { display:flex; align-items:baseline; justify-content:space-between; gap:14px; padding:2.5px 0; }
      .controls-row span { color:#aaa994; }
      .controls-row strong { flex:none; color:#dbc987; font:700 11px ui-monospace,Menlo,monospace; }
      @media (max-width:600px) { #controls-cluster { left:5px; bottom:5px; } #controls-card { left:5px; bottom:47px; } }
      @media (prefers-reduced-motion:reduce) { .controls-chip, #controls-card { backdrop-filter:none; } }
    `;
    document.head.appendChild(style);
  }
}
