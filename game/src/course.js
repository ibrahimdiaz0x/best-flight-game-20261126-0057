// The course a mission flies: golden rings to thread, parcels to collect,
// storm cells to avoid, and the runway waiting at the end of an Island Hop.
// Built once from the mission and the seed; the plane's z decides what is next.

import { RUNWAYS, riverCentre } from './islands.js';

/** Lay out a mission's rings, parcels and storms along the flight path. */
export function buildCourse(mission, chance) {
  const rings = [];
  const ringCount = mission.rings;
  for (let i = 0; i < ringCount; i += 1) {
    const z = 700 + ((mission.lengthMetres - 1400) / Math.max(1, ringCount)) * (i + 0.5);
    // A smooth course: neighbouring rings never jump far sideways or in
    // altitude, so a pilot can actually fly through each one in turn.
    rings.push({
      z,
      x: Math.sin(i * 1.15 + 0.4) * 250 + chance.range(-40, 40),
      altFt: 2350 + Math.sin(i * 0.85 + 0.2) * 250 + chance.range(-60, 60),
      passed: false,
      missed: false,
    });
  }
  const parcels = [];
  for (let i = 0; i < mission.parcels; i += 1) {
    parcels.push({
      z: 900 + i * ((mission.lengthMetres - 1600) / Math.max(1, mission.parcels)),
      x: Math.cos(i * 1.3 + 0.8) * 260 + chance.range(-40, 40),
      altFt: 2300 + Math.sin(i * 1.1) * 250 + chance.range(-60, 60),
      taken: false,
    });
  }
  const storms = [];
  for (let i = 0; i < mission.storms; i += 1) {
    storms.push({
      z: 1800 + i * 1900,
      x: chance.range(-220, 220),
      radius: chance.range(150, 230),
      topFt: 5200,
    });
  }
  const destination = mission.id === 'hop' ? RUNWAYS[1] : null;
  return { mission, rings, parcels, storms, destination, score: 0, ringsHit: 0, parcelsHit: 0 };
}

/** The next ring the plane has not yet reached, or null when the course is done. */
export function nextRing(course, planeZ) {
  for (let i = 0; i < course.rings.length; i += 1) {
    if (!course.rings[i].passed && !course.rings[i].missed && course.rings[i].z >= planeZ - 5) return course.rings[i];
  }
  return null;
}

/** The next parcel not yet taken, or null. */
export function nextParcel(course, planeZ) {
  for (let i = 0; i < course.parcels.length; i += 1) {
    if (!course.parcels[i].taken && course.parcels[i].z >= planeZ - 5) return course.parcels[i];
  }
  return null;
}

/** True while the plane sits inside any storm cell. */
export function insideStorm(course, plane) {
  for (let i = 0; i < course.storms.length; i += 1) {
    const cell = course.storms[i];
    const dz = plane.z - cell.z;
    const dx = plane.x - cell.x;
    if (dx * dx + dz * dz < cell.radius * cell.radius && plane.altFt < cell.topFt) return cell;
  }
  return null;
}

/**
 * Check what the plane crossed since `previousZ`: rings threaded or missed,
 * parcels collected. Returns the points earned on this step.
 */
export function crossedObjects(course, plane, previousZ, ringRadius, ringTolFt, parcelRadius, parcelTolFt) {
  let earned = 0;
  for (let i = 0; i < course.rings.length; i += 1) {
    const ring = course.rings[i];
    if (ring.passed || ring.missed || previousZ >= ring.z || plane.z < ring.z) continue;
    const lateral = Math.abs(plane.x - ring.x);
    const vertical = Math.abs(plane.altFt - ring.altFt);
    if (lateral <= ringRadius && vertical <= ringTolFt) {
      ring.passed = true;
      course.ringsHit += 1;
      earned += 100;
    } else {
      ring.missed = true;
    }
  }
  for (let i = 0; i < course.parcels.length; i += 1) {
    const parcel = course.parcels[i];
    if (parcel.taken || previousZ >= parcel.z || plane.z < parcel.z) continue;
    if (Math.abs(plane.x - parcel.x) <= parcelRadius && Math.abs(plane.altFt - parcel.altFt) <= parcelTolFt) {
      parcel.taken = true;
      course.parcelsHit += 1;
      earned += 150;
    }
  }
  course.score += earned;
  return earned;
}

/** The harbour town's river bend, for the painter's water. */
export function riverAt(z) {
  return riverCentre(z);
}
