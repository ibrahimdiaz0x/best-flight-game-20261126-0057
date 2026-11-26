// A tiny seeded chance source, so a ?seed=N flight always builds the same
// islands, rings and weather. Nothing here touches the DOM or the clock.

/** A 32-bit hash of one integer, used to colour a terrain cell without storing it. */
export function cellHash(a, b, salt) {
  let h = (a * 374761393 + b * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function makeChance(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(low, high) {
    return low + (high - low) * next();
  }
  function whole(low, high) {
    return low + Math.floor(next() * (high - low + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  return { next, range, whole, pick };
}
