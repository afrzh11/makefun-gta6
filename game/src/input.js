// Keyboard + mouse input. Held keys are read every frame; one-shot presses
// (confirm, pause, interact) are queued as edge flags and taken once, so a press
// between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKey(e, isDown) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (isDown) {
      if (e.repeat) return;
      held.add(e.code);
      if (CONFIRM.has(e.code)) actions |= ACTION_CONFIRM;
      if (PAUSE.has(e.code)) actions |= ACTION_PAUSE;
      if (INTERACT.has(e.code)) actions |= ACTION_INTERACT;
    } else {
      held.delete(e.code);
    }
  }

  target.addEventListener('keydown', (e) => onKey(e, true));
  target.addEventListener('keyup', (e) => onKey(e, false));
  target.addEventListener('blur', () => held.clear());
  target.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  target.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; mouse.x = e.clientX; mouse.y = e.clientY; });
  target.addEventListener('mouseup', () => { mouse.down = false; });

  function axis(neg, pos) {
    let v = 0;
    for (const c of neg) if (held.has(c)) v -= 1;
    for (const c of pos) if (held.has(c)) v += 1;
    return v;
  }

  return {
    mouse,
    /** -1/0/1 steering. */
    steer() { return axis(LEFT, RIGHT); },
    /** -1/0/1 throttle (up = forward). */
    throttle() { return axis(DOWN, UP); },
    /** Is Space held (handbrake in a car, punch on foot)? */
    punchHeld() { for (const c of PUNCH) if (held.has(c)) return true; return false; },
    runHeld() { for (const c of RUN) if (held.has(c)) return true; return false; },
    /** Take (and clear) the queued one-shot actions. */
    takeActions() { const a = actions; actions = 0; return a; },
    /** End of frame: clear the mouse click edge. */
    endFrame() { mouse.clicked = false; },
  };
}
