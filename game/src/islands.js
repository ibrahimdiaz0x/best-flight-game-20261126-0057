// The Meridian Isles, as data: a river that winds across the flight path, a
// coast road, field patchwork, forest clumps, a harbour town and two runways.
// The painter asks for slices of it by distance flown; nothing here draws.

import { cellHash } from './chance.js';

/** Lateral centre of the river, in metres east of the runway centreline, at distance z. */
export function riverCentre(z) {
  return Math.sin(z * 0.00042) * 260 + Math.sin(z * 0.0011 + 1.7) * 90;
}

/** Lateral centre of the coast road at distance z. */
export function roadCentre(z) {
  return Math.sin(z * 0.00031 + 0.6) * 330 - 120;
}

/** Which field palette a ground cell uses: 0..3, stable for a given cell. */
export function fieldKind(row, column) {
  return Math.floor(cellHash(row, column, 7) * 4);
}

/** Whether a ground cell holds a forest clump. */
export function hasForest(row, column) {
  return cellHash(row, column, 21) < 0.16;
}

/** Whether a ground cell holds a farmhouse. */
export function hasFarmhouse(row, column) {
  return cellHash(row, column, 33) < 0.07;
}

/**
 * The harbour town sits beside the river around z = 3000; its houses are laid
 * out in rows the painter draws as small roofed blocks.
 */
export function townHouses() {
  const houses = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (cellHash(row, col, 55) < 0.3) continue;
      houses.push({
        z: 2880 + row * 55,
        x: riverCentre(3000) + 130 + col * 46 - 140,
        w: 26 + cellHash(row, col, 56) * 10,
        h: 18 + cellHash(row, col, 57) * 8,
      });
    }
  }
  return houses;
}

/** The two runways of the game, each with its centreline and heading. */
export const RUNWAYS = [
  { name: 'Meridian Field', number: '36', x: 0, z: 0, heading: 0, length: 900 },
  { name: 'Coral Runway', number: '36', x: 180, z: 5400, heading: 0, length: 800 },
];

/** Clouds drift slowly; each has a sky position and a size, fixed by seed. */
export function makeClouds(seedChance, count) {
  const clouds = [];
  for (let i = 0; i < count; i += 1) {
    clouds.push({
      x: seedChance.range(-700, 1900),
      y: seedChance.range(24, 150),
      w: seedChance.range(90, 260),
      h: seedChance.range(18, 42),
      drift: seedChance.range(2, 9),
    });
  }
  return clouds;
}
