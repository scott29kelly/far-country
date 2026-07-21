/**
 * Dev-only gamepad diagnostic — `?padtest=1`, NEVER in the public build
 * (the dynamic import in main.ts sits inside a literal `import.meta.env.DEV`
 * branch, so `vite build` dead-code-eliminates it; same contract as
 * EditPanel).
 *
 * Why this exists: multi-platform pads (GameSir/8BitDo/Switch-family) present
 * DIFFERENT devices to Chrome depending on which mode they are in and how they
 * are connected. In XInput mode Chrome reports `mapping: "standard"` and the
 * Xbox indices GamepadInput assumes; over Bluetooth on generic-HID firmware
 * the same pad can arrive as DirectInput with `mapping: ""`, shuffled button
 * indices, and triggers on AXES rather than analog buttons. Guessing a remap
 * from a model name is unreliable — this panel reads the truth off the actual
 * hardware.
 *
 * Two halves:
 *  - LIVE: what Chrome reports (id / mapping / axes / buttons) beside what
 *    GamepadInput produces after deadzone + curve, so a stick that feels dead
 *    can be told apart from a stick the deadzone is eating.
 *  - CAPTURE: a guided "press this control now" walk that records which index
 *    each engine binding actually lands on — including whether a trigger is a
 *    button or an axis — and emits a JSON remap table.
 *
 * It polls its OWN GamepadInput instance, never FlyCamera's: poll() consumes
 * rising edges, so sharing one instance would eat the camera's button presses.
 */

import type { Engine } from '../core/Engine';
import { GamepadInput } from '../core/GamepadInput';

/** the engine bindings, in the order CAPTURE walks them */
interface CaptureStep {
  key: string;
  prompt: string;
  role: string;
}
const STEPS: CaptureStep[] = [
  { key: 'a', prompt: 'A  (bottom face button)', role: 'jump' },
  { key: 'b', prompt: 'B  (right face button)', role: 'dismiss card / cancel cruise' },
  { key: 'y', prompt: 'Y  (top face button)', role: 'walk/fly toggle' },
  { key: 'start', prompt: 'START / MENU', role: 'walk/fly toggle' },
  { key: 'lb', prompt: 'LB  (left bumper)', role: 'slower' },
  { key: 'rb', prompt: 'RB  (right bumper)', role: 'faster' },
  { key: 'lt', prompt: 'LT  (left trigger, squeeze fully)', role: 'fly down' },
  { key: 'rt', prompt: 'RT  (right trigger, squeeze fully)', role: 'fly up' },
];

/** what the standard mapping expects — shown beside the captured index */
const STANDARD_INDEX: Record<string, number> = {
  a: 0,
  b: 1,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  start: 9,
};

interface CapturedBinding {
  source: 'button' | 'axis';
  index: number;
  /** the control reported a graduated value, not just pressed/released */
  analog: boolean;
}

const AXIS_TRIGGER_DELTA = 0.5; // an axis must move this far from rest to count

export function initPadTest(engine: Engine): void {
  installStyles();
  const input = new GamepadInput();

  const root = document.createElement('div');
  root.id = 'padtest';
  document.body.appendChild(root);

  const head = document.createElement('div');
  head.className = 'pt-head';
  head.innerHTML = '<strong>GAMEPAD DIAGNOSTIC</strong><span class="pt-sub">?padtest=1 · dev only</span>';
  root.appendChild(head);

  const verdict = document.createElement('div');
  verdict.className = 'pt-verdict';
  root.appendChild(verdict);

  const live = document.createElement('div');
  live.className = 'pt-live';
  root.appendChild(live);

  const capRow = document.createElement('div');
  capRow.className = 'pt-caprow';
  const capButton = document.createElement('button');
  capButton.type = 'button';
  capButton.className = 'pt-btn';
  capButton.textContent = 'Start capture';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'pt-btn';
  copyButton.textContent = 'Copy report';
  capRow.append(capButton, copyButton);
  root.appendChild(capRow);

  const capOut = document.createElement('div');
  capOut.className = 'pt-cap';
  root.appendChild(capOut);

  // ---- capture state ------------------------------------------------------
  let capturing = false;
  let stepIndex = 0;
  const captured = new Map<string, CapturedBinding>();
  let axisBaseline: number[] = [];
  let prevPressed: boolean[] = [];
  /** ignore the frame the user clicked "Start capture" on */
  let armFrames = 0;

  const beginCapture = (): void => {
    capturing = true;
    stepIndex = 0;
    captured.clear();
    armFrames = 12;
    capButton.textContent = 'Cancel capture';
    snapshotBaseline();
  };
  const endCapture = (): void => {
    capturing = false;
    capButton.textContent = captured.size > 0 ? 'Re-run capture' : 'Start capture';
  };
  function snapshotBaseline(): void {
    const pad = firstPad();
    axisBaseline = pad ? Array.from(pad.axes) : [];
    prevPressed = pad ? pad.buttons.map((b) => b.pressed) : [];
  }
  capButton.addEventListener('click', () => {
    if (capturing) endCapture();
    else beginCapture();
  });
  copyButton.addEventListener('click', () => {
    const text = buildReport();
    void navigator.clipboard?.writeText(text).then(
      () => {
        copyButton.textContent = 'Copied';
        window.setTimeout(() => {
          copyButton.textContent = 'Copy report';
        }, 1200);
      },
      () => {
        // clipboard can be denied — fall back to the console so the report is
        // still recoverable
        // eslint-disable-next-line no-console
        console.log(text);
        copyButton.textContent = 'See console';
        window.setTimeout(() => {
          copyButton.textContent = 'Copy report';
        }, 1600);
      },
    );
  });

  function firstPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    try {
      for (const p of navigator.getGamepads()) if (p && p.connected) return p;
    } catch {
      return null;
    }
    return null;
  }

  function buildReport(): string {
    const pad = firstPad();
    const bindings: Record<string, CapturedBinding | null> = {};
    for (const step of STEPS) bindings[step.key] = captured.get(step.key) ?? null;
    return JSON.stringify(
      {
        tool: 'padtest',
        userAgent: navigator.userAgent,
        pad: pad
          ? {
              id: pad.id,
              mapping: pad.mapping,
              index: pad.index,
              axes: Array.from(pad.axes).map((v) => Number(v.toFixed(3))),
              buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: Number(b.value.toFixed(3)) })),
            }
          : null,
        standardIndices: STANDARD_INDEX,
        captured: bindings,
      },
      null,
      2,
    );
  }

  function bar(v: number, signed: boolean): string {
    const t = signed ? (v + 1) / 2 : v;
    const filled = Math.round(Math.max(0, Math.min(1, t)) * 16);
    return `${'█'.repeat(filled)}${'·'.repeat(16 - filled)}`;
  }

  engine.onUpdate(() => {
    const pad = firstPad();
    const frame = input.poll();

    if (!pad) {
      verdict.className = 'pt-verdict pt-warn';
      verdict.textContent =
        'No pad visible. Chrome hides controllers until their first button press — press any button. If nothing appears, the pad is not in a mode Windows exposes as a game controller.';
      live.innerHTML = '';
      if (capturing) endCapture();
      return;
    }

    const standard = pad.mapping === 'standard';
    verdict.className = `pt-verdict ${standard ? 'pt-ok' : 'pt-warn'}`;
    verdict.textContent = standard
      ? 'mapping "standard" — Chrome recognises the Xbox layout. The engine bindings apply as-is.'
      : `mapping "${pad.mapping}" — NONSTANDARD. Button indices may not match the Xbox layout. Run the capture below.`;

    const axesRows = Array.from(pad.axes)
      .map((v, i) => `<div class="pt-row"><span class="pt-i">ax${i}</span><span class="pt-bar">${bar(v, true)}</span><span class="pt-v">${v.toFixed(3)}</span></div>`)
      .join('');
    const buttonRows = pad.buttons
      .map((b, i) => {
        const label = Object.entries(STANDARD_INDEX).find(([, idx]) => idx === i)?.[0] ?? '';
        const cls = b.pressed ? 'pt-row pt-on' : 'pt-row';
        return `<div class="${cls}"><span class="pt-i">b${i}</span><span class="pt-bar">${bar(b.value, false)}</span><span class="pt-v">${b.value.toFixed(2)}</span><span class="pt-tag">${label}</span></div>`;
      })
      .join('');

    live.innerHTML = `
      <div class="pt-id">${escapeHtml(pad.id)}</div>
      <div class="pt-meta">index ${pad.index} · ${pad.axes.length} axes · ${pad.buttons.length} buttons</div>
      <div class="pt-sec">SHAPED (what the camera consumes)</div>
      <div class="pt-row"><span class="pt-i">move</span><span class="pt-v">x ${frame.moveX.toFixed(2)}  y ${frame.moveY.toFixed(2)}</span></div>
      <div class="pt-row"><span class="pt-i">look</span><span class="pt-v">x ${frame.lookX.toFixed(2)}  y ${frame.lookY.toFixed(2)}</span></div>
      <div class="pt-row"><span class="pt-i">fly</span><span class="pt-v">up ${frame.flyUp.toFixed(2)}  down ${frame.flyDown.toFixed(2)}</span></div>
      <div class="pt-sec">AXES</div>${axesRows}
      <div class="pt-sec">BUTTONS</div>${buttonRows}`;

    // ---- guided capture ---------------------------------------------------
    if (!capturing) {
      if (captured.size > 0) renderCapture(null);
      return;
    }
    if (armFrames > 0) {
      armFrames--;
      renderCapture(STEPS[stepIndex] ?? null);
      return;
    }
    const step = STEPS[stepIndex];
    if (!step) {
      endCapture();
      renderCapture(null);
      return;
    }

    // a button rising edge wins; otherwise an axis that has left its rest value
    let hit: CapturedBinding | null = null;
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      if (b && b.pressed && !prevPressed[i]) {
        hit = { source: 'button', index: i, analog: b.value > 0 && b.value < 1 };
        break;
      }
    }
    if (!hit) {
      for (let i = 0; i < pad.axes.length; i++) {
        const now = pad.axes[i] ?? 0;
        const rest = axisBaseline[i] ?? 0;
        if (Math.abs(now - rest) > AXIS_TRIGGER_DELTA) {
          hit = { source: 'axis', index: i, analog: true };
          break;
        }
      }
    }
    prevPressed = pad.buttons.map((b) => b.pressed);

    if (hit) {
      captured.set(step.key, hit);
      stepIndex++;
      armFrames = 20; // debounce so one press can't fill two steps
      snapshotBaseline();
      if (stepIndex >= STEPS.length) {
        endCapture();
        renderCapture(null);
        return;
      }
    }
    renderCapture(STEPS[stepIndex] ?? null);
  });

  function renderCapture(active: CaptureStep | null): void {
    const lines = STEPS.map((step) => {
      const got = captured.get(step.key);
      const expect = STANDARD_INDEX[step.key];
      if (!got) {
        const cls = active && active.key === step.key ? 'pt-cap-row pt-cap-active' : 'pt-cap-row';
        return `<div class="${cls}"><span class="pt-cap-name">${escapeHtml(step.prompt)}</span><span class="pt-cap-val">${active && active.key === step.key ? 'press it now…' : '—'}</span></div>`;
      }
      const where = got.source === 'button' ? `b${got.index}` : `ax${got.index}`;
      const matches = got.source === 'button' && got.index === expect;
      const note = matches ? 'matches standard' : `standard expects b${expect}`;
      return `<div class="pt-cap-row ${matches ? 'pt-ok-t' : 'pt-warn-t'}"><span class="pt-cap-name">${escapeHtml(step.prompt)}</span><span class="pt-cap-val">${where}${got.analog ? ' analog' : ''} · ${note}</span></div>`;
    }).join('');
    capOut.innerHTML =
      (capturing ? '<div class="pt-cap-hint">Press each control as prompted. Skip one by pressing any other button.</div>' : '') +
      lines;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function installStyles(): void {
  if (document.getElementById('padtest-styles')) return;
  const style = document.createElement('style');
  style.id = 'padtest-styles';
  style.textContent = `
#padtest{position:fixed;left:10px;bottom:10px;z-index:1200;width:min(370px,calc(100vw - 20px));
  max-height:calc(100vh - 20px);overflow:auto;box-sizing:border-box;
  background:rgba(8,12,10,.92);backdrop-filter:blur(12px);
  border:1px solid rgba(226,211,161,.38);border-radius:12px;padding:12px;
  color:#eee9d7;font:11px/1.45 ui-monospace,Menlo,monospace;}
#padtest .pt-head strong{display:block;color:#f4efd9;letter-spacing:.12em;font-size:11px;}
#padtest .pt-sub{color:#8f948b;font-size:10px;}
#padtest .pt-verdict{margin:9px 0;border-radius:7px;padding:7px 8px;font-size:10px;line-height:1.5;}
#padtest .pt-ok{background:rgba(63,158,99,.16);border:1px solid rgba(63,158,99,.5);color:#bfe6cd;}
#padtest .pt-warn{background:rgba(184,134,45,.15);border:1px solid rgba(184,134,45,.5);color:#f0dcae;}
#padtest .pt-id{color:#dbc987;font-size:10px;word-break:break-all;}
#padtest .pt-meta{color:#8f948b;font-size:10px;margin-top:2px;}
#padtest .pt-sec{margin:9px 0 4px;color:#aaa994;font-size:9px;letter-spacing:.14em;
  border-top:1px solid rgba(255,255,255,.09);padding-top:6px;}
#padtest .pt-row{display:flex;align-items:center;gap:7px;padding:1px 0;color:#c8c5b7;}
#padtest .pt-row.pt-on{color:#fff8dd;}
#padtest .pt-i{width:34px;flex:none;color:#8f948b;}
#padtest .pt-bar{letter-spacing:-1px;color:#5f6b5f;}
#padtest .pt-row.pt-on .pt-bar{color:#dbc987;}
#padtest .pt-v{flex:1;font-size:10px;}
#padtest .pt-tag{color:#7a8a7a;font-size:9px;}
#padtest .pt-caprow{display:flex;gap:6px;margin-top:10px;}
#padtest .pt-btn{flex:1;border:1px solid rgba(255,255,255,.14);border-radius:7px;padding:6px;
  color:#ddd9c8;background:rgba(255,255,255,.05);cursor:pointer;font:10px ui-monospace,monospace;}
#padtest .pt-btn:hover{border-color:rgba(219,201,135,.6);background:rgba(219,201,135,.12);}
#padtest .pt-cap{margin-top:8px;}
#padtest .pt-cap-hint{color:#8f948b;font-size:9px;margin-bottom:5px;}
#padtest .pt-cap-row{display:flex;justify-content:space-between;gap:8px;padding:2px 0;font-size:10px;
  color:#a9a695;}
#padtest .pt-cap-active{color:#fff8dd;background:rgba(219,201,135,.14);border-radius:5px;padding:2px 5px;}
#padtest .pt-ok-t{color:#bfe6cd;}
#padtest .pt-warn-t{color:#f0dcae;}
#padtest .pt-cap-name{flex:1;}
#padtest .pt-cap-val{flex:none;color:inherit;opacity:.85;}`;
  document.head.appendChild(style);
}
