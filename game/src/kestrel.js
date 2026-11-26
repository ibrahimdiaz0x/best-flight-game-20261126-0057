// The Kestrel-9: one plane, one state object, one step function. Arcade
// physics on purpose — throttle sets a target speed, bank turns the nose,
// pitch trades speed for altitude — with fuel, hull and a stall to manage.

import { KESTREL, LANDING, STEP } from './config.js';

const METRES_PER_NM = 1852;
const KNOT_TO_MS = 0.514444;
const DEG = Math.PI / 180;

/** A fresh plane for a mission: parked or airborne, as the mission says. */
export function newKestrel(mission) {
  return {
    x: 0,
    z: 0,
    altFt: mission.startAltFt,
    speedKt: mission.startSpeedKt,
    headingDeg: 0,
    bankDeg: 0,
    pitchDeg: 0,
    throttle: mission.id === 'hop' ? 0 : 0.45,
    fuel: 100,
    hull: 100,
    verticalFpm: 0,
    onGround: mission.startAltFt <= 0,
    airborne: mission.startAltFt > 0,
    timeS: 0,
    distanceM: 0,
  };
}

function approach(value, target, rate, dt) {
  if (value < target) return Math.min(target, value + rate * dt);
  return Math.max(target, value - rate * dt);
}

/**
 * Advance the plane one fixed step. `stick` is { roll: -1..1, pitch: -1..1,
 * throttle: -1..1 } from the controls; `gust` is an extra bank wobble in
 * degrees per second, from a storm cell. Returns a note: 'landed', 'crashed',
 * 'stalled', 'fuel-out' or ''.
 */
export function advanceKestrel(plane, stick, gust, dt) {
  plane.timeS += dt;
  plane.throttle = Math.min(1, Math.max(0, plane.throttle + stick.throttle * dt * 0.55));
  plane.bankDeg = approach(plane.bankDeg, stick.roll * KESTREL.maxBank, KESTREL.bankRate, dt);
  plane.pitchDeg = approach(plane.pitchDeg, stick.pitch * KESTREL.maxPitch, KESTREL.pitchRate, dt);

  const targetSpeed = 80 + plane.throttle * (KESTREL.maxSpeed - 80);
  const speedRate = plane.airborne ? 11 : 17;
  plane.speedKt = approach(plane.speedKt, targetSpeed, speedRate, dt);
  if (plane.pitchDeg > 4) plane.speedKt = Math.max(KESTREL.minSpeed, plane.speedKt - plane.pitchDeg * 0.35 * dt);
  if (plane.pitchDeg < -4) plane.speedKt = Math.min(KESTREL.maxSpeed, plane.speedKt - plane.pitchDeg * 0.3 * dt);

  const effectiveBank = plane.bankDeg + gust;
  const turnRate = effectiveBank * KESTREL.turnFactor * (plane.speedKt / KESTREL.cruiseSpeed);
  plane.headingDeg = (plane.headingDeg + turnRate * dt + 360) % 360;

  // A slow plane cannot hold altitude: below stall speed it sinks.
  const stalled = plane.airborne && plane.speedKt < KESTREL.stallSpeed;
  const climbRate = plane.speedKt * 101.3 * Math.sin(plane.pitchDeg * DEG);
  plane.verticalFpm = stalled ? -900 : climbRate;
  plane.altFt += (plane.verticalFpm / 60) * dt;

  const forwardMs = plane.speedKt * KNOT_TO_MS;
  const headingRad = plane.headingDeg * DEG;
  plane.x += Math.sin(headingRad) * forwardMs * dt;
  plane.z += Math.cos(headingRad) * forwardMs * dt;
  plane.distanceM += forwardMs * dt;

  plane.fuel = Math.max(0, plane.fuel - (KESTREL.fuelIdle + KESTREL.fuelThrottle * plane.throttle) * dt);

  // Rotation: a fast enough plane on the runway lifts off.
  if (plane.onGround && plane.speedKt > 74 && plane.pitchDeg > 3) {
    plane.onGround = false;
    plane.airborne = true;
    plane.altFt = Math.max(plane.altFt, 2);
  }
  // Touchdown: only a gentle, slow, aligned arrival on a runway counts.
  if (plane.airborne && plane.altFt <= 0) {
    plane.altFt = 0;
    plane.airborne = false;
    plane.onGround = true;
    // Keep the sink rate for the landing judge before the state is levelled.
    plane.lastSinkFpm = -plane.verticalFpm;
    plane.verticalFpm = 0;
    return 'touched';
  }
  if (plane.fuel <= 0 && plane.airborne) return 'fuel-out';
  if (stalled) return 'stalled';
  return '';
}

/** How far, in metres, the plane sits from a runway's centreline. */
export function runwayOffset(plane, runway) {
  return plane.x - runway.x;
}

/**
 * Judge a touchdown on `runway`: returns 'landed' when it is gentle, slow
 * and aligned, otherwise 'crashed' with a reason.
 */
export function judgeTouchdown(plane, runway) {
  const sink = plane.lastSinkFpm ?? -plane.verticalFpm;
  const headingError = Math.abs(((plane.headingDeg - runway.heading + 540) % 360) - 180);
  if (Math.abs(runwayOffset(plane, runway)) > LANDING.runwayHalfWidth) return { result: 'crashed', reason: 'off the runway' };
  if (plane.z < runway.z - 100 || plane.z > runway.z + runway.length) return { result: 'crashed', reason: 'overshot the runway' };
  if (sink > LANDING.maxSinkFpm) return { result: 'crashed', reason: 'came down too hard' };
  if (plane.speedKt > LANDING.maxSpeedKt) return { result: 'crashed', reason: 'too fast to land' };
  if (headingError > LANDING.maxHeadingError) return { result: 'crashed', reason: 'not lined up with the runway' };
  return { result: 'landed', reason: '' };
}

export { STEP, METRES_PER_NM };
