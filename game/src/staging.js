// The screenshot scenes behind ?shot=start|play|land. Each one plays the real
// rules forward from a fresh flight for a fixed time, steered by a simple
// autopilot that chases the next ring or the destination runway, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame.

import { STEP } from './config.js';
import { advanceKestrel, judgeTouchdown } from './kestrel.js';
import { RUNWAYS } from './islands.js';
import { crossedObjects, insideStorm, nextParcel, nextRing } from './course.js';
import { RING, PARCEL } from './config.js';
import { SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './painter.js';

const START_HOLD_S = 4;
const PLAY_S = 34;
const LAND_LIMIT_S = 240;

/** Steer toward a target: bank toward the heading that closes the lateral
 * gap, and pitch for the vertical speed that closes the altitude gap. */
function steerToward(plane, targetX, targetAltFt) {
  const lookAheadM = 300;
  const desiredHeadingDeg = (Math.atan2(targetX - plane.x, lookAheadM) * 180) / Math.PI;
  let headingError = ((desiredHeadingDeg - plane.headingDeg + 540) % 360) - 180;
  const roll = Math.max(-1, Math.min(1, headingError / 14));
  const altError = targetAltFt - plane.altFt;
  // Ask for a firm vertical speed, damped by the one the plane already has,
  // so the altitude settles instead of seesawing past the target.
  const wantedVsFpm = Math.max(-2600, Math.min(2600, altError * 3 - plane.verticalFpm * 0.6));
  const speedFactor = Math.max(60, plane.speedKt) * 101.3;
  const wantedPitchDeg = (Math.asin(Math.max(-0.22, Math.min(0.22, wantedVsFpm / speedFactor))) * 180) / Math.PI;
  const pitch = Math.max(-1, Math.min(1, wantedPitchDeg / 13));
  const throttle = plane.speedKt < 118 ? 1 : plane.speedKt > 138 ? -1 : 0;
  return { roll, pitch, throttle };
}

/** Run the flight forward, applying one autopilot step per fixed step. */
function flyForward(flight, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const previousZ = flight.plane.z;
    const stick = steer(flight.plane, flight.course);
    const storm = insideStorm(flight.course, flight.plane);
    const gust = storm ? Math.sin(flight.plane.timeS * 3) * 8 : 0;
    const note = advanceKestrel(flight.plane, stick, gust, STEP);
    if (storm) flight.plane.hull = Math.max(0, flight.plane.hull - (9 * STEP));
    crossedObjects(flight.course, flight.plane, previousZ, RING.radiusMetres, RING.heightToleranceFt, PARCEL.radiusMetres, PARCEL.heightToleranceFt);
    if (note === 'touched') {
      const runway = RUNWAYS.reduce((best, r) => (Math.abs(r.z - flight.plane.z) < Math.abs(best.z - flight.plane.z) ? r : best), RUNWAYS[0]);
      return judgeTouchdown(flight.plane, runway);
    }
    if (note === 'fuel-out' || flight.plane.hull <= 0) return { result: 'crashed', reason: note === 'fuel-out' ? 'Out of fuel.' : 'Storm damage.' };
  }
  return null;
}

/**
 * Set `flight` to the named scene (start, play or land; any other name is
 * start) and return the screen to draw over it and the line to show.
 */
export function stageScene(name, flight) {
  if (name !== 'play' && name !== 'land') {
    for (let i = 0; i < Math.round(START_HOLD_S / STEP); i += 1) {
      advanceKestrel(flight.plane, { roll: 0, pitch: 0, throttle: 0 }, 0, STEP);
    }
    return { screen: SCREEN_TITLE, reason: '' };
  }
  if (name === 'play') {
    const outcome = flyForward(flight, PLAY_S, (plane, course) => {
      const ring = nextRing(course, plane.z);
      const parcel = nextParcel(course, plane.z);
      const target = ring || parcel;
      if (!target) return { roll: 0, pitch: 0, throttle: 0 };
      return steerToward(plane, target.x, target.altFt);
    });
    if (outcome) return { screen: outcome.result === 'landed' ? SCREEN_DONE : SCREEN_OVER, reason: outcome.reason };
    return { screen: SCREEN_PLAY, reason: '' };
  }
  // land: cruise low toward the destination, join the glidepath 2500 m out,
  // then ease down onto it. Rings on the way are scenery, not a detour.
  const outcome = flyForward(flight, LAND_LIMIT_S, (plane, course) => {
    const runway = course.destination;
    const dist = runway.z - plane.z;
    if (dist < 2500) {
      // Glidepath: 0.17 ft of altitude per metre of distance, flown with a
      // feedforward vertical speed for the slope plus a correction for the
      // gap to the path, so the plane arrives on the numbers, not above them.
      // Past the threshold the path simply runs to zero on the runway.
      const glideAlt = Math.max(0, dist * 0.17);
      const stick = steerToward(plane, runway.x, glideAlt);
      const forwardMs = plane.speedKt * 0.514444;
      const rampVsFpm = -forwardMs * 0.17 * 60;
      const wantedVsFpm = rampVsFpm + (glideAlt - plane.altFt) * 4;
      const wantedPitchDeg = (Math.asin(Math.max(-0.22, Math.min(0.22, wantedVsFpm / (Math.max(60, plane.speedKt) * 101.3)))) * 180) / Math.PI;
      stick.pitch = Math.max(-1, Math.min(1, wantedPitchDeg / 13));
      stick.throttle = plane.speedKt > 102 ? -1 : plane.speedKt < 92 ? 1 : 0;
      return stick;
    }
    return steerToward(plane, runway.x, 800);
  });
  if (outcome && outcome.result === 'landed') {
    flight.course.score += 500;
    return { screen: SCREEN_DONE, reason: 'Landed clean on Coral Runway. +500' };
  }
  if (outcome) return { screen: SCREEN_OVER, reason: outcome.reason };
  return { screen: SCREEN_PLAY, reason: '' };
}
