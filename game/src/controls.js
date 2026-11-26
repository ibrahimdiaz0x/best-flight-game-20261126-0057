// Keyboard and mouse, read once a frame. Arrow keys or WASD fly the plane,
// Shift / Ctrl work the throttle, Space confirms, P pauses, 1-3 pick a
// mission on the title screen, and moving the mouse steers while it is held.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_MISSION_1 = 4;
export const ACT_MISSION_2 = 8;
export const ACT_MISSION_3 = 16;
export const ACT_RESTART = 32;

const HANDLED_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

export function attachControls(canvas) {
  const keys = new Set();
  let actions = 0;
  let pointerX = 0.5;
  let pointerActive = false;
  let pointerDown = false;

  function onKeyDown(event) {
    if (HANDLED_KEYS.includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACT_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    if (event.code === 'Digit1') actions |= ACT_MISSION_1;
    if (event.code === 'Digit2') actions |= ACT_MISSION_2;
    if (event.code === 'Digit3') actions |= ACT_MISSION_3;
    if (event.code === 'KeyR') actions |= ACT_RESTART;
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    pointerActive = true;
  }
  function onPointerDown(event) {
    pointerDown = true;
    onPointerMove(event);
    actions |= ACT_CONFIRM;
  }
  function onPointerUp() {
    pointerDown = false;
  }
  function onBlur() {
    keys.clear();
    pointerDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  /** The stick for this frame: roll and pitch -1..1, throttle -1..1. */
  function stick() {
    let roll = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    let pitch = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
    let throttle = 0;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle += 1;
    if (keys.has('ControlLeft') || keys.has('ControlRight')) throttle -= 1;
    // Mouse steering: while the pointer is down, its sideways place is the bank.
    if (pointerDown && pointerActive) roll = (pointerX - 0.5) * 2;
    return { roll, pitch, throttle };
  }

  /** Actions pressed since the last call; each is reported once. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { stick, takeActions };
}
