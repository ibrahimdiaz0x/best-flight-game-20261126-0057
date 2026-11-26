// Meridian Skies: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the painter scales it to the
// window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720, horizon: 188, panelTop: 556 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How far ahead, in metres, the painter draws terrain and course objects. */
export const DRAW_AHEAD = 2600;

export const KESTREL = {
  // Knots: the Kestrel-9 courier plane cruises near 120 and stalls near 62.
  minSpeed: 55,
  maxSpeed: 192,
  stallSpeed: 64,
  cruiseSpeed: 122,
  // Degrees per second the bank and pitch chase the pilot's input.
  bankRate: 68,
  pitchRate: 26,
  maxBank: 38,
  maxPitch: 13,
  // Heading change, degrees per second, per degree of bank at cruise speed.
  turnFactor: 0.21,
  // Fuel: percent per second at idle, plus per unit of throttle.
  fuelIdle: 0.1,
  fuelThrottle: 0.24,
  // Damage per second spent inside a storm cell.
  stormDamage: 9,
};

export const RING = {
  radiusMetres: 45,
  heightToleranceFt: 160,
  points: 100,
};

export const PARCEL = { radiusMetres: 40, heightToleranceFt: 180, points: 150 };

/** A gentle landing: vertical speed, speed and alignment limits. */
export const LANDING = { maxSinkFpm: 700, maxSpeedKt: 112, maxHeadingError: 14, runwayHalfWidth: 15 };

export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'Ring Run',
    blurb: 'Thread 8 golden rings over Meridian Bay.',
    rings: 8,
    parcels: 0,
    storms: 0,
    lengthMetres: 6400,
    startAltFt: 2500,
    startSpeedKt: 122,
  },
  {
    id: 'hop',
    key: '2',
    name: 'Island Hop',
    blurb: 'Take off from Meridian Field and land on Coral Runway.',
    rings: 3,
    parcels: 0,
    storms: 0,
    lengthMetres: 5400,
    startAltFt: 0,
    startSpeedKt: 0,
  },
  {
    id: 'courier',
    key: '3',
    name: 'Courier Dash',
    blurb: 'Collect 6 parcels before the fuel runs dry. Mind the storms.',
    rings: 2,
    parcels: 6,
    storms: 2,
    lengthMetres: 5600,
    startAltFt: 2200,
    startSpeedKt: 118,
  },
];

export const COLOURS = {
  skyTop: '#5fb2e8',
  skyMid: '#a8d8f2',
  skyLow: '#e8f4fb',
  sun: '#ffd94d',
  cloud: '#ffffff',
  mountainFar: '#8fb4cc',
  mountainNear: '#6d97b5',
  sea: '#3f8fc4',
  fieldA: '#7fae56',
  fieldB: '#a8bf5a',
  fieldC: '#c2b25e',
  fieldD: '#5d9b52',
  forest: '#3f7a3a',
  river: '#4d9bd6',
  road: '#8a8f96',
  townRoof: '#c96f4a',
  townWall: '#e8dcc8',
  runway: '#4a4f57',
  runwayMark: '#f4f6f8',
  ring: '#ffc93c',
  ringDone: '#9fb3c0',
  parcel: '#ff8c42',
  storm: '#5a6472',
  panel: '#151b26',
  panelEdge: '#2c3648',
  gaugeFace: '#0d1420',
  gaugeLit: '#7df9d8',
  gaugeAmber: '#ffb02e',
  gaugeRed: '#ff5a4e',
  hudText: '#eaf6ff',
  hudBox: 'rgba(10, 22, 34, 0.62)',
  planeBody: '#e8eef4',
  planeTrim: '#e2574c',
  planeGlass: '#274b63',
  planeProp: 'rgba(220, 230, 238, 0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-skies.best';
