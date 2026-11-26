// Boot and the one loop: the stick is read every frame, the Kestrel-9
// advances in fixed 1/60 s steps, and the painter draws what is there. The
// game moves between five screens: title, play, paused, flight over and
// mission complete.
//
// ?seed=N fixes the islands and the course. ?mission=rings|hop|courier picks
// the mission. ?shot=start|play|land (with &seed=N and &mission=…) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { makeChance } from './chance.js';
import { makeClouds, RUNWAYS } from './islands.js';
import { advanceKestrel, judgeTouchdown, newKestrel } from './kestrel.js';
import { buildCourse, crossedObjects, insideStorm } from './course.js';
import { ACT_CONFIRM, ACT_MISSION_1, ACT_MISSION_2, ACT_MISSION_3, ACT_PAUSE, ACT_RESTART, attachControls } from './controls.js';
import { PARCEL, RING } from './config.js';
import { makePainter, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './painter.js';
import { stageScene } from './staging.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const missionParam = params.get('mission') || 'rings';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const painter = makePainter(canvas);

function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

function newFlight(missionId, seedValue) {
  const chance = makeChance(seedValue);
  const mission = missionById(missionId);
  return {
    mission,
    plane: newKestrel(mission),
    course: buildCourse(mission, chance),
    clouds: makeClouds(chance, 7),
    time: 0,
  };}

let flight = newFlight(missionParam, seed);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

// A tiny beep from the Web Audio API: a ring chimes high, a parcel lower,
// a crash thuds. No audio files, nothing fetched.
let audio = null;
function blip(frequency, seconds) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = frequency;
    tone.connect(gain);
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    tone.start();
    tone.stop(audio.currentTime + seconds);
  } catch {
    // Sound is garnish: a browser without audio still flies.
  }
}

function runShot(name) {
  const scene = stageScene(name, flight);
  let painted = 0;
  function paint() {
    painter.draw({
      plane: flight.plane,
      course: flight.course,
      mission: flight.mission,
      clouds: flight.clouds,
      time: flight.plane.timeS,
      screen: scene.screen,
      best: Math.max(readBest(), flight.course.score),
      reason: scene.reason,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = attachControls(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let reason = '';
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFlight(missionId) {
    flight = newFlight(missionId, Math.floor(Math.random() * 4294967296));
    accumulator = 0;
    reason = '';
    screen = SCREEN_PLAY;
    announce('Flying ' + flight.mission.name + '. Follow the golden rings.');
  }

  function finishFlight(finalScreen, finalReason) {
    screen = finalScreen;
    reason = finalReason;
    if (flight.course.score > best) {
      best = flight.course.score;
      saveBest(best);
    }
    announce(finalScreen === SCREEN_DONE ? 'Mission complete. Score ' + flight.course.score + '.' : 'Flight over. ' + finalReason);
  }

  function nearestRunway() {
    return RUNWAYS.reduce((closest, r) => (Math.abs(r.z - flight.plane.z) < Math.abs(closest.z - flight.plane.z) ? r : closest), RUNWAYS[0]);
  }

  function stepFlight() {
    const plane = flight.plane;
    const previousZ = plane.z;
    const storm = insideStorm(flight.course, plane);
    const gust = storm ? Math.sin(plane.timeS * 3) * 8 : 0;
    const note = advanceKestrel(plane, input.stick(), gust, STEP);
    if (storm) {
      plane.hull = Math.max(0, plane.hull - (9 * STEP));
      if (plane.hull <= 0) {
        finishFlight(SCREEN_OVER, 'The storm tore the Kestrel-9 apart.');
        return;
      }
    }
    const earned = crossedObjects(flight.course, plane, previousZ, RING.radiusMetres, RING.heightToleranceFt, PARCEL.radiusMetres, PARCEL.heightToleranceFt);
    if (earned >= 150) blip(520, 0.18);
    else if (earned > 0) blip(880, 0.22);
    if (note === 'touched') {
      const runway = nearestRunway();
      const verdict = judgeTouchdown(plane, runway);
      if (verdict.result === 'landed') {
        if (flight.course.destination && runway === flight.course.destination) {
          flight.course.score += 500;
          finishFlight(SCREEN_DONE, 'Landed clean on ' + runway.name + '. +500');
        } else {
          finishFlight(SCREEN_OVER, 'Landed at ' + runway.name + ' — not the destination.');
        }
      } else {
        blip(120, 0.4);
        finishFlight(SCREEN_OVER, 'Crashed: ' + verdict.reason + '.');
      }
      return;
    }
    if (note === 'fuel-out') {
      finishFlight(SCREEN_OVER, 'Out of fuel over the islands.');
      return;
    }
    // The course is done once every ring is settled and the plane has flown past the last one.
    const ringsSettled = flight.course.rings.every((r) => r.passed || r.missed);
    const parcelsSettled = flight.course.parcels.every((p) => p.taken);
    const pastEnd = plane.z > flight.mission.lengthMetres;
    if (ringsSettled && parcelsSettled && pastEnd && flight.mission.id !== 'hop') {
      if (flight.course.ringsHit === flight.course.rings.length && flight.course.rings.length > 0) flight.course.score += 200;
      finishFlight(SCREEN_DONE, 'Course complete over the Meridian Isles.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT_RESTART && screen !== SCREEN_TITLE) {
      startFlight(flight.mission.id);
      return;
    }
    if (actions & ACT_MISSION_1 && screen === SCREEN_TITLE) startFlight('rings');
    else if (actions & ACT_MISSION_2 && screen === SCREEN_TITLE) startFlight('hop');
    else if (actions & ACT_MISSION_3 && screen === SCREEN_TITLE) startFlight('courier');
    else if (actions & ACT_CONFIRM && screen === SCREEN_TITLE) startFlight('rings');
    else if (actions & ACT_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_DONE)) startFlight(flight.mission.id);
    else if (actions & ACT_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACT_PAUSE | ACT_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    flight.time += frameSeconds;
    accumulator += frameSeconds;
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepFlight();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    painter.draw({
      plane: flight.plane,
      course: flight.course,
      mission: flight.mission,
      clouds: flight.clouds,
      time: flight.time,
      screen,
      best,
      reason,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Meridian Skies. Press 1, 2 or 3 to pick a mission.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
