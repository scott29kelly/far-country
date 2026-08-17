/**
 * Browser Gamepad API input — polled, because the API is poll-only (no
 * events fire for stick motion; Chrome snapshots pad state on each
 * navigator.getGamepads() call). FlyCamera is the ONE consumer: this
 * module never moves the camera, it only shapes raw hardware state into a
 * per-frame GamepadFrame snapshot, so FlyCamera stays the single movement
 * owner.
 *
 * Layout (Chrome "standard" mapping — an Xbox/XInput pad over USB or
 * Bluetooth on Windows lands here):
 *
 *   left stick    move (ground/fly; analog magnitude scales speed)
 *   right stick   steer — mouse-steer-equivalent yaw/pitch rates
 *   D-pad         up = fly mode, down = walk mode, right/left = speed step
 *                 (the legible non-gamer bindings — Scott's design)
 *   RT / LT       fly up / down (analog)
 *   RB / LB       travel speed step up / down (the ] / [ keys)
 *   Start or Y    walk/fly toggle (the V key)
 *   B             Escape-equivalent (dismiss entity card, cancel cruise)
 *   A             jump (walk mode)
 *   View          toggle the controls guide overlay
 *
 * Pads reporting a nonstandard mapping (Switch pads over Bluetooth often
 * do) get the same layout best-effort: sticks on axes 0-3 are near
 * universal, buttons may land on other indices — warned once per pad id
 * rather than guessed at, and nothing crashes on a pad with fewer
 * axes/buttons (every read is index-guarded).
 *
 * Sticks: radial deadzone (a resting stick, or post-connect drift,
 * produces exactly zero — programmatic poses keep exact placement with a
 * pad idle on the desk) + response curve — linear for move, expo (t²) for
 * steer so small deflections turn gently (same non-gamer motivation as
 * the mouse-steer dead zone).
 *
 * Chrome only exposes a pad after its first button press — `active` flips
 * true at that moment and NavigationUI surfaces a PAD hint from it.
 */

const PAD_DEADZONE = 0.15; // radial, fraction of full deflection
const PAD_TRIGGER_MIN = 0.08; // analog triggers idle slightly above 0 on worn pads

// standard-mapping button indices
const BTN_A = 0;
const BTN_B = 1;
const BTN_Y = 3;
const BTN_LB = 4;
const BTN_RB = 5;
const BTN_LT = 6;
const BTN_RT = 7;
const BTN_VIEW = 8;
const BTN_START = 9;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;

export interface GamepadFrame {
  /** a pad is connected and exposed (Chrome hides pads until a button press) */
  active: boolean;
  /** left stick, radial-deadzoned, linear: +x strafe right, +y forward */
  moveX: number;
  moveY: number;
  /** right stick, radial-deadzoned, expo: +x look right, +y look down */
  lookX: number;
  lookY: number;
  /** analog triggers 0..1: RT climbs, LT descends (fly mode) */
  flyUp: number;
  flyDown: number;
  /** rising edges — true for exactly one poll per physical press */
  speedUp: boolean; // RB
  speedDown: boolean; // LB
  toggleMode: boolean; // Start or Y
  dismiss: boolean; // B
  jump: boolean; // A
  help: boolean; // View — toggle the pad controls overlay
  /** D-pad rising edges — up enters fly, down enters walk, right/left step speed */
  flyMode: boolean; // D-pad up
  walkMode: boolean; // D-pad down
  speedUp2: boolean; // D-pad right (mirrors RB)
  speedDown2: boolean; // D-pad left (mirrors LB)
}

const IDLE_FRAME: GamepadFrame = {
  active: false,
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  flyUp: 0,
  flyDown: 0,
  speedUp: false,
  speedDown: false,
  toggleMode: false,
  dismiss: false,
  jump: false,
  help: false,
  flyMode: false,
  walkMode: false,
  speedUp2: false,
  speedDown2: false,
};

/** injectable pad source — CPU probes hand in fake Gamepad objects (the
 *  walkfling idiom: real FlyCamera physics under Node, no browser) */
export type GamepadSource = () => ReadonlyArray<Gamepad | null>;

const defaultSource: GamepadSource = () => {
  // guarded: Node (CPU probes) has no navigator.getGamepads, and an iframe
  // denied by Permissions-Policy throws instead of returning an empty list
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  try {
    return navigator.getGamepads();
  } catch {
    return [];
  }
};

/** radial deadzone then response curve, direction preserved */
function shapeStick(x: number, y: number, expo: boolean): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag <= PAD_DEADZONE) return { x: 0, y: 0 };
  const t = Math.min(1, (mag - PAD_DEADZONE) / (1 - PAD_DEADZONE));
  const k = (expo ? t * t : t) / mag;
  return { x: x * k, y: y * k };
}

export class GamepadInput {
  /** replaceable for CPU probes; defaults to navigator.getGamepads */
  source: GamepadSource = defaultSource;

  // previous pressed states for rising-edge detection
  private prevSpeedUp = false;
  private prevSpeedDown = false;
  private prevToggle = false;
  private prevDismiss = false;
  private prevJump = false;
  private prevHelp = false;
  private prevDpadUp = false;
  private prevDpadDown = false;
  private prevDpadLeft = false;
  private prevDpadRight = false;
  private warnedIds = new Set<string>();

  /** one snapshot per frame — edge fields fire exactly once per press */
  poll(): GamepadFrame {
    // Prefer a standard-mapping pad over any other connected device: some
    // controllers (and their bundled receivers) expose a second generic-HID
    // entry alongside the real XInput one, and a lower slot index does not
    // mean the better device. Falls back to the first connected pad.
    let pad: Gamepad | null = null;
    for (const p of this.source()) {
      if (!p || !p.connected) continue;
      if (p.mapping === 'standard') {
        pad = p;
        break;
      }
      if (!pad) pad = p;
    }
    if (!pad) {
      // a held button across a disconnect must not suppress (or fake) the
      // edge on reconnect — forget everything
      this.prevSpeedUp = this.prevSpeedDown = this.prevToggle = false;
      this.prevDismiss = this.prevJump = this.prevHelp = false;
      this.prevDpadUp = this.prevDpadDown = this.prevDpadLeft = this.prevDpadRight = false;
      return IDLE_FRAME;
    }
    if (pad.mapping !== 'standard' && !this.warnedIds.has(pad.id)) {
      this.warnedIds.add(pad.id);
      // eslint-disable-next-line no-console
      console.warn(
        `[laas] gamepad "${pad.id}" reports mapping "${pad.mapping}" — using the standard ` +
          'Xbox layout best-effort (sticks on axes 0-3; buttons may land on other indices)',
      );
    }

    const axis = (i: number): number => pad.axes[i] ?? 0;
    const pressed = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
    const value = (i: number): number => pad.buttons[i]?.value ?? 0;

    // stick up is axes[1] = -1 → moveY +1 = forward
    const move = shapeStick(axis(0), -axis(1), false);
    const look = shapeStick(axis(2), axis(3), true);
    const rt = value(BTN_RT);
    const lt = value(BTN_LT);

    const speedUpNow = pressed(BTN_RB);
    const speedDownNow = pressed(BTN_LB);
    const toggleNow = pressed(BTN_START) || pressed(BTN_Y);
    const dismissNow = pressed(BTN_B);
    const jumpNow = pressed(BTN_A);
    const helpNow = pressed(BTN_VIEW);
    const dpadUpNow = pressed(BTN_DPAD_UP);
    const dpadDownNow = pressed(BTN_DPAD_DOWN);
    const dpadLeftNow = pressed(BTN_DPAD_LEFT);
    const dpadRightNow = pressed(BTN_DPAD_RIGHT);
    const frame: GamepadFrame = {
      active: true,
      moveX: move.x,
      moveY: move.y,
      lookX: look.x,
      lookY: look.y,
      flyUp: rt >= PAD_TRIGGER_MIN ? rt : 0,
      flyDown: lt >= PAD_TRIGGER_MIN ? lt : 0,
      speedUp: speedUpNow && !this.prevSpeedUp,
      speedDown: speedDownNow && !this.prevSpeedDown,
      toggleMode: toggleNow && !this.prevToggle,
      dismiss: dismissNow && !this.prevDismiss,
      jump: jumpNow && !this.prevJump,
      help: helpNow && !this.prevHelp,
      flyMode: dpadUpNow && !this.prevDpadUp,
      walkMode: dpadDownNow && !this.prevDpadDown,
      speedUp2: dpadRightNow && !this.prevDpadRight,
      speedDown2: dpadLeftNow && !this.prevDpadLeft,
    };
    this.prevSpeedUp = speedUpNow;
    this.prevSpeedDown = speedDownNow;
    this.prevToggle = toggleNow;
    this.prevDismiss = dismissNow;
    this.prevJump = jumpNow;
    this.prevHelp = helpNow;
    this.prevDpadUp = dpadUpNow;
    this.prevDpadDown = dpadDownNow;
    this.prevDpadLeft = dpadLeftNow;
    this.prevDpadRight = dpadRightNow;
    return frame;
  }
}
