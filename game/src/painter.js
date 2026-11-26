// Drawing only: the flight's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. Sky on
// top, scrolling island terrain below the horizon, the Kestrel-9 in chase
// view in the middle, and a lit instrument panel along the bottom.

import { COLOURS, DRAW_AHEAD, FONT, KESTREL, MISSIONS, VIEW } from './config.js';
import { RUNWAYS, fieldKind, hasFarmhouse, hasForest, riverCentre, roadCentre, townHouses } from './islands.js';
import { nextParcel, nextRing } from './course.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

const FIELD_COLOURS = [COLOURS.fieldA, COLOURS.fieldB, COLOURS.fieldC, COLOURS.fieldD];
const CENTRE_X = VIEW.width / 2;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Screen height of ground at `dist` metres ahead of the plane. */
function groundHeight(dist) {
  const t = Math.pow(clamp(dist, 0, DRAW_AHEAD) / DRAW_AHEAD, 0.75);
  return VIEW.panelTop - (VIEW.panelTop - VIEW.horizon) * t;
}

export function makePainter(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const houses = townHouses();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, colour, align, bold) {
    ctx.font = (bold ? '700 ' : '') + size + 'px ' + FONT;
    ctx.fillStyle = colour;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** Project a world point to the screen: lateral metres, altitude feet, distance ahead. */
  function project(lateral, altFt, dist) {
    const s = 900 / (dist + 260);
    return {
      x: CENTRE_X + lateral * s * 1.15,
      y: groundHeight(dist) - altFt * 0.09 * s,
      s,
    };
  }

  function drawSky(state) {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.horizon + 40);
    sky.addColorStop(0, COLOURS.skyTop);
    sky.addColorStop(0.6, COLOURS.skyMid);
    sky.addColorStop(1, COLOURS.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.horizon + 40);
    // Sun, upper right, with a soft glow.
    const sunX = 1060;
    const sunY = 62;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255, 217, 77, 0.9)');
    glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = COLOURS.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Clouds drift with the clock.
    ctx.fillStyle = COLOURS.cloud;
    for (const cloud of state.clouds) {
      const cx = ((cloud.x + state.time * cloud.drift) % 1500) - 110;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(cx, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cloud.w * 0.28, cloud.y + 8, cloud.w * 0.32, cloud.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Two hazy mountain ridges along the horizon.
    drawRidge(VIEW.horizon, 46, COLOURS.mountainFar, 3);
    drawRidge(VIEW.horizon + 16, 30, COLOURS.mountainNear, 11);
  }

  function drawRidge(baseY, height, colour, seed) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    let x = 0;
    let i = 0;
    while (x < VIEW.width) {
      const peak = height * (0.5 + 0.5 * Math.sin(i * 2.7 + seed));
      ctx.lineTo(x + 70, baseY - peak);
      ctx.lineTo(x + 140, baseY - peak * 0.3);
      x += 140;
      i += 1;
    }
    ctx.lineTo(VIEW.width, baseY);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(state) {
    const plane = state.plane;
    // A base field colour first, so the ground never shows the page behind it
    // where the patchwork bands end at the sides.
    ctx.fillStyle = COLOURS.fieldA;
    ctx.fillRect(0, VIEW.horizon, VIEW.width, VIEW.panelTop - VIEW.horizon);
    // The sea glints at the far edge of the bay.
    ctx.fillStyle = COLOURS.sea;
    ctx.fillRect(0, VIEW.horizon, VIEW.width, 26);
    const bandStep = 130;
    for (let dist = DRAW_AHEAD; dist > 0; dist -= bandStep) {
      const near = dist - bandStep;
      const yFar = groundHeight(dist);
      const yNear = groundHeight(Math.max(0, near));
      if (yNear - yFar < 1) continue;
      const row = Math.floor((plane.z + dist) / 240);
      for (let col = -3; col < 3; col += 1) {
        const leftFar = project(col * 300 - plane.x * 0.35, 0, dist);
        const rightFar = project((col + 1) * 300 - plane.x * 0.35, 0, dist);
        const leftNear = project(col * 300 - plane.x * 0.35, 0, Math.max(0, near));
        const rightNear = project((col + 1) * 300 - plane.x * 0.35, 0, Math.max(0, near));
        ctx.fillStyle = FIELD_COLOURS[fieldKind(row, col + 3)];
        ctx.beginPath();
        ctx.moveTo(leftFar.x, yFar);
        ctx.lineTo(rightFar.x, yFar);
        ctx.lineTo(rightNear.x, yNear);
        ctx.lineTo(leftNear.x, yNear);
        ctx.closePath();
        ctx.fill();
        if (hasForest(row, col + 3)) {
          ctx.fillStyle = COLOURS.forest;
          const tx = (leftNear.x + rightNear.x) / 2;
          const ty = (yFar + yNear) / 2;
          ctx.beginPath();
          ctx.arc(tx, ty, 7 + (yNear - yFar) * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
        if (hasFarmhouse(row, col + 3)) {
          const fx = (leftNear.x + rightNear.x) / 2;
          const fy = (yFar + yNear) / 2;
          ctx.fillStyle = COLOURS.townWall;
          ctx.fillRect(fx - 5, fy - 5, 10, 8);
          ctx.fillStyle = COLOURS.townRoof;
          ctx.beginPath();
          ctx.moveTo(fx - 6, fy - 5);
          ctx.lineTo(fx, fy - 11);
          ctx.lineTo(fx + 6, fy - 5);
          ctx.closePath();
          ctx.fill();
        }
      }
      // The river winds through this band.
      drawWaterBand(plane.z + dist, plane.z + Math.max(0, near), yFar, yNear, plane, riverCentre, COLOURS.river, 30);
      // The coast road follows its own bend.
      drawWaterBand(plane.z + dist, plane.z + Math.max(0, near), yFar, yNear, plane, roadCentre, COLOURS.road, 9);
    }
    // Harbour town houses beside the river.
    for (const house of houses) {
      const dist = house.z - plane.z;
      if (dist < 20 || dist > DRAW_AHEAD) continue;
      const p = project(house.x - plane.x, 0, dist);
      const w = Math.max(4, house.w * p.s * 0.4);
      const h = Math.max(3, house.h * p.s * 0.4);
      ctx.fillStyle = COLOURS.townWall;
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.fillStyle = COLOURS.townRoof;
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2 - 1, p.y - h);
      ctx.lineTo(p.x, p.y - h - h * 0.55);
      ctx.lineTo(p.x + w / 2 + 1, p.y - h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWaterBand(zFar, zNear, yFar, yNear, plane, centreAt, colour, halfWidth) {
    const cFar = project(centreAt(zFar) - plane.x, 0, zFar - plane.z);
    const cNear = project(centreAt(zNear) - plane.x, 0, zNear - plane.z);
    const wFar = halfWidth * cFar.s;
    const wNear = halfWidth * cNear.s;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cFar.x - wFar, yFar);
    ctx.lineTo(cFar.x + wFar, yFar);
    ctx.lineTo(cNear.x + wNear, yNear);
    ctx.lineTo(cNear.x - wNear, yNear);
    ctx.closePath();
    ctx.fill();
  }

  function drawRunways(state) {
    const plane = state.plane;
    for (const runway of RUNWAYS) {
      const distNear = runway.z - plane.z;
      const distFar = distNear + runway.length;
      if (distFar < -80 || distNear > DRAW_AHEAD) continue;
      const left = [];
      const right = [];
      for (let d = Math.max(-80, distNear); d <= Math.min(DRAW_AHEAD, distFar); d += 100) {
        left.push(project(runway.x - 15 - plane.x, 0, d));
        right.push(project(runway.x + 15 - plane.x, 0, d));
      }
      ctx.fillStyle = COLOURS.runway;
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (const p of left) ctx.lineTo(p.x, p.y);
      for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes and the runway number.
      ctx.fillStyle = COLOURS.runwayMark;
      for (let d = Math.max(0, distNear) + 40; d < Math.min(DRAW_AHEAD, distFar); d += 160) {
        const a = project(runway.x - plane.x, 0, d);
        const b = project(runway.x - plane.x, 0, d + 55);
        ctx.fillRect(a.x - 1.5, b.y, 3, a.y - b.y);
      }
      const label = project(runway.x - plane.x, 0, clamp(distFar - 60, 0, DRAW_AHEAD));
      text(runway.number, label.x, label.y - 6, Math.max(12, 26 * label.s), COLOURS.runwayMark, 'center', true);
      const name = project(runway.x - plane.x, 0, clamp(distFar - 60, 0, DRAW_AHEAD));
      text(runway.name, name.x, name.y + 18, Math.max(10, 15 * label.s), COLOURS.hudText, 'center');
    }
  }

  function drawCourseObjects(state) {
    const plane = state.plane;
    const course = state.course;
    const items = [];
    for (const ring of course.rings) items.push({ kind: 'ring', z: ring.z, x: ring.x, alt: ring.altFt, done: ring.passed, missed: ring.missed });
    for (const parcel of course.parcels) items.push({ kind: 'parcel', z: parcel.z, x: parcel.x, alt: parcel.altFt, done: parcel.taken, missed: false });
    for (const storm of course.storms) items.push({ kind: 'storm', z: storm.z, x: storm.x, alt: 2600, done: false, missed: false, radius: storm.radius });
    items.sort((a, b) => b.z - a.z);
    for (const item of items) {
      const dist = item.z - plane.z;
      if (dist < 10 || dist > DRAW_AHEAD) continue;
      const p = project(item.x - plane.x, item.alt, dist);
      if (item.kind === 'ring') {
        const radius = 30 * p.s * 1.15;
        ctx.lineWidth = Math.max(3, 7 * p.s);
        ctx.strokeStyle = item.done ? COLOURS.ringDone : item.missed ? 'rgba(160,170,180,0.7)' : COLOURS.ring;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius, radius * 0.86, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        if (!item.done && !item.missed) {
          ctx.fillStyle = 'rgba(255, 201, 60, 0.25)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, radius * 0.92, radius * 0.78, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.kind === 'parcel') {
        if (item.done) continue;
        const size = Math.max(8, 26 * p.s);
        ctx.fillStyle = COLOURS.parcel;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size * 0.8);
        ctx.fillStyle = '#fff3e0';
        ctx.fillRect(p.x - size / 2, p.y - size * 0.18, size, size * 0.16);
        // A small drawn star above the crate, so the parcel reads at a glance.
        ctx.fillStyle = '#ffe9b0';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - size * 1.15);
        ctx.lineTo(p.x + size * 0.14, p.y - size * 0.72);
        ctx.lineTo(p.x + size * 0.55, p.y - size * 0.72);
        ctx.lineTo(p.x + size * 0.22, p.y - size * 0.45);
        ctx.lineTo(p.x + size * 0.34, p.y - size * 0.08);
        ctx.lineTo(p.x, p.y - size * 0.3);
        ctx.lineTo(p.x - size * 0.34, p.y - size * 0.08);
        ctx.lineTo(p.x - size * 0.22, p.y - size * 0.45);
        ctx.lineTo(p.x - size * 0.55, p.y - size * 0.72);
        ctx.lineTo(p.x - size * 0.14, p.y - size * 0.72);
        ctx.closePath();
        ctx.fill();
      } else {
        const radius = item.radius * p.s * 0.5;
        ctx.fillStyle = 'rgba(90, 100, 114, 0.55)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 30 * p.s, radius, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(70, 80, 95, 0.6)';
        ctx.beginPath();
        ctx.ellipse(p.x - radius * 0.4, p.y - 55 * p.s, radius * 0.6, radius * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        text('STORM', p.x, p.y - 70 * p.s, Math.max(11, 18 * p.s), '#ffd94d', 'center', true);
      }
    }
    // A guide to the next ring or parcel, so the pilot always sees the goal.
    const target = nextRing(course, plane.z) || nextParcel(course, plane.z);
    if (target && state.screen === SCREEN_PLAY) {
      const dist = Math.max(0, Math.round(target.z - plane.z));
      const p = project(target.x - plane.x, target.altFt, Math.max(60, dist));
      const gx = clamp(p.x, 90, VIEW.width - 90);
      const gy = clamp(p.y, 210, VIEW.panelTop - 30);
      ctx.strokeStyle = COLOURS.ring;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 14);
      ctx.lineTo(gx + 10, gy + 8);
      ctx.lineTo(gx - 10, gy + 8);
      ctx.closePath();
      ctx.stroke();
      text(dist + ' m', gx, gy + 30, 15, COLOURS.hudText, 'center', true);
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    const bob = Math.sin(state.time * 2.2) * 2;
    const px = CENTRE_X;
    const py = 392 + bob;
    // The plane's shadow on the ground below, shrinking as it climbs.
    const shadowScale = clamp(1 - plane.altFt / 5200, 0.25, 1);
    ctx.fillStyle = 'rgba(20, 30, 40, ' + (0.28 * shadowScale + 0.06).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(px, 548, 95 * shadowScale, 12 * shadowScale + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((-plane.bankDeg * Math.PI) / 180);
    // Wings, with red tips and navigation lights.
    ctx.fillStyle = COLOURS.planeBody;
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.lineTo(-34, -8);
    ctx.lineTo(34, -8);
    ctx.lineTo(150, 6);
    ctx.lineTo(138, 20);
    ctx.lineTo(0, 16);
    ctx.lineTo(-138, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.fillRect(-150, 6, 26, 11);
    ctx.fillRect(124, 6, 26, 11);
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(-152, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37e08a';
    ctx.beginPath();
    ctx.arc(152, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin and stabilisers.
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-16, -52);
    ctx.lineTo(0, -96);
    ctx.lineTo(16, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOURS.planeBody;
    ctx.beginPath();
    ctx.moveTo(-58, -46);
    ctx.lineTo(58, -46);
    ctx.lineTo(44, -32);
    ctx.lineTo(-44, -32);
    ctx.closePath();
    ctx.fill();
    // Fuselage, seen from behind, with the Kestrel-9 cheatline.
    ctx.fillStyle = COLOURS.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, -6, 30, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.fillRect(-30, -18, 60, 7);
    ctx.fillStyle = COLOURS.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -34, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Engine cowling and the spinning prop disc.
    ctx.fillStyle = '#2c3648';
    ctx.beginPath();
    ctx.arc(0, 8, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.planeProp;
    ctx.beginPath();
    ctx.ellipse(0, 8, 5, 46, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 8, 5, 46, -0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Flight-path marker just ahead of the nose.
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py - 118, 9, 0, Math.PI * 2);
    ctx.moveTo(px, py - 132);
    ctx.lineTo(px, py - 126);
    ctx.moveTo(px, py - 104);
    ctx.lineTo(px, py - 110);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawHud(state) {
    const plane = state.plane;
    const course = state.course;
    const box = (x, label, value, unit) => {
      ctx.fillStyle = COLOURS.hudBox;
      ctx.fillRect(x, 14, 176, 62);
      ctx.strokeStyle = 'rgba(125, 249, 216, 0.5)';
      ctx.strokeRect(x, 14, 176, 62);
      text(label, x + 12, 36, 13, COLOURS.gaugeLit, 'left', true);
      text(value, x + 12, 66, 26, COLOURS.hudText, 'left', true);
      text(unit, x + 164, 66, 13, COLOURS.gaugeLit, 'right');
    };
    box(20, 'ALTITUDE', Math.round(plane.altFt).toLocaleString('en-US'), 'FT');
    box(212, 'AIRSPEED', Math.round(plane.speedKt) + '', 'KT');
    const heading = String(Math.round(plane.headingDeg) % 360).padStart(3, '0');
    box(404, 'HEADING', heading, '°');
    // Mission, score and progress, top right.
    ctx.fillStyle = COLOURS.hudBox;
    ctx.fillRect(880, 14, 380, 62);
    ctx.strokeStyle = 'rgba(125, 249, 216, 0.5)';
    ctx.strokeRect(880, 14, 380, 62);
    text(state.mission.name.toUpperCase(), 896, 36, 13, COLOURS.gaugeLit, 'left', true);
    text('SCORE ' + course.score, 896, 66, 22, COLOURS.hudText, 'left', true);
    const ringsDone = course.ringsHit + ' / ' + course.rings.length + ' RINGS';
    const parcelsDone = course.parcels.length ? '  ·  ' + course.parcelsHit + ' / ' + course.parcels.length + ' PARCELS' : '';
    text(ringsDone + parcelsDone, 1244, 66, 15, COLOURS.hudText, 'right');
    if (plane.fuel < 25 && state.screen === SCREEN_PLAY) {
      text('LOW FUEL', CENTRE_X, 108, 20, COLOURS.gaugeAmber, 'center', true);
    }
    if (plane.speedKt < KESTREL.stallSpeed && plane.airborne && state.screen === SCREEN_PLAY) {
      text('STALL — ADD THROTTLE', CENTRE_X, 136, 20, COLOURS.gaugeRed, 'center', true);
    }
  }

  function drawPanel(state) {
    const plane = state.plane;
    ctx.fillStyle = COLOURS.panel;
    ctx.fillRect(0, VIEW.panelTop, VIEW.width, VIEW.height - VIEW.panelTop);
    ctx.fillStyle = COLOURS.panelEdge;
    ctx.fillRect(0, VIEW.panelTop, VIEW.width, 3);
    ctx.fillStyle = '#2c3648';
    ctx.fillRect(0, VIEW.panelTop + 3, VIEW.width, 1);
    drawArtificialHorizon(plane);
    drawDial(395, 638, 46, plane.altFt / 10000, 'ALT', Math.round(plane.altFt) + ' FT');
    drawDial(545, 638, 46, plane.speedKt / 200, 'SPD', Math.round(plane.speedKt) + ' KT');
    drawCompass(plane);
    drawBars(plane);
    text('MERIDIAN SKIES', 1264, 700, 13, '#8b93a3', 'right');
  }

  function drawArtificialHorizon(plane) {
    const cx = 180;
    const cy = 638;
    const r = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-plane.bankDeg * Math.PI) / 180);
    ctx.translate(0, plane.pitchDeg * 2.4);
    ctx.fillStyle = '#3f8fc4';
    ctx.fillRect(-r - 4, -r - 4, (r + 4) * 2, r + 4);
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(-r - 4, 0, (r + 4) * 2, r + 4);
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-r - 4, -2, (r + 4) * 2, 4);
    ctx.restore();
    ctx.strokeStyle = COLOURS.gaugeLit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Fixed aircraft symbol over the moving horizon.
    ctx.strokeStyle = '#f4f6f8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.lineWidth = 1;
    text('ATTITUDE', cx, cy + r + 20, 12, COLOURS.gaugeLit, 'center', true);
  }

  function drawDial(cx, cy, r, fraction, label, value) {
    ctx.fillStyle = COLOURS.gaugeFace;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOURS.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.strokeStyle = '#8b93a3';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    const needle = -Math.PI * 0.75 + clamp(fraction, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = COLOURS.gaugeLit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needle) * (r - 10), cy + Math.sin(needle) * (r - 10));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = COLOURS.gaugeLit;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    text(label, cx, cy + r + 20, 12, COLOURS.gaugeLit, 'center', true);
    text(value, cx, cy + 8, 13, COLOURS.hudText, 'center', true);
  }

  function drawCompass(plane) {
    const cx = 770;
    const cy = 638;
    const points = [
      [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
    ];
    ctx.fillStyle = COLOURS.gaugeFace;
    ctx.fillRect(cx - 130, cy - 26, 260, 52);
    ctx.strokeStyle = COLOURS.panelEdge;
    ctx.strokeRect(cx - 130, cy - 26, 260, 52);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 130, cy - 26, 260, 52);
    ctx.clip();
    for (const [deg, label] of points) {
      let diff = ((deg - plane.headingDeg + 540) % 360) - 180;
      const x = cx + diff * 2.1;
      if (x < cx - 140 || x > cx + 140) continue;
      text(label, x, cy + 6, deg % 90 === 0 ? 17 : 12, deg % 90 === 0 ? COLOURS.hudText : '#8b93a3', 'center', deg % 90 === 0);
    }
    ctx.restore();
    ctx.fillStyle = COLOURS.gaugeLit;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 30);
    ctx.lineTo(cx + 6, cy - 30);
    ctx.lineTo(cx, cy - 18);
    ctx.closePath();
    ctx.fill();
    text('HDG ' + String(Math.round(plane.headingDeg) % 360).padStart(3, '0') + '°', cx, cy + 46, 12, COLOURS.gaugeLit, 'center', true);
  }

  function drawBars(plane) {
    const fuelX = 1010;
    const thrX = 1070;
    const top = 590;
    const height = 84;
    const bar = (x, fraction, colour, label) => {
      ctx.fillStyle = COLOURS.gaugeFace;
      ctx.fillRect(x, top, 34, height);
      ctx.fillStyle = fraction < 0.25 ? COLOURS.gaugeRed : colour;
      const fill = Math.round(height * clamp(fraction, 0, 1));
      ctx.fillRect(x, top + height - fill, 34, fill);
      ctx.strokeStyle = COLOURS.panelEdge;
      ctx.strokeRect(x, top, 34, height);
      text(label, x + 17, top + height + 20, 12, COLOURS.gaugeLit, 'center', true);
    };
    bar(fuelX, plane.fuel / 100, COLOURS.gaugeAmber, 'FUEL');
    bar(thrX, plane.throttle, COLOURS.gaugeLit, 'THR');
    text(Math.round(plane.fuel) + '%', fuelX + 17, top - 10, 13, COLOURS.hudText, 'center', true);
    text(Math.round(plane.throttle * 100) + '%', thrX + 17, top - 10, 13, COLOURS.hudText, 'center', true);
    // Warning lamps.
    const lamp = (x, lit, colour, label) => {
      ctx.fillStyle = lit ? colour : '#2c3648';
      ctx.beginPath();
      ctx.arc(x, top + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      text(label, x, top + 28, 10, lit ? colour : '#8b93a3', 'center', true);
    };
    lamp(1160, plane.fuel < 25, COLOURS.gaugeAmber, 'FUEL');
    lamp(1210, plane.speedKt < KESTREL.stallSpeed && plane.airborne, COLOURS.gaugeRed, 'STALL');
  }

  function drawOverlay(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 780;
    const height = 150 + lines.length * 30;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2 - 40;
    ctx.fillStyle = 'rgba(16, 24, 36, 0.94)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || COLOURS.gaugeLit;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.lineWidth = 1;
    text(title, CENTRE_X, y + 58, 40, COLOURS.hudText, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], CENTRE_X, y + 104 + i * 30, 18, '#c8d4e0', 'center');
    }
    text(prompt, CENTRE_X, y + height - 26, 17, COLOURS.gaugeLit, 'center', true);
  }

  /** Paint one frame: sky, terrain, course, plane, HUD, panel, then the screen's overlay. */
  function draw(state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state);
    drawTerrain(state);
    drawRunways(state);
    drawCourseObjects(state);
    drawPlane(state);
    drawHud(state);
    drawPanel(state);
    if (state.screen === SCREEN_TITLE) {
      const missionLines = [
        '1 — Ring Run: thread 8 golden rings over the bay.',
        '2 — Island Hop: take off, then land on Coral Runway.',
        '3 — Courier Dash: collect 6 parcels, mind the storms.',
      ];
      drawOverlay(
        'MERIDIAN SKIES',
        [
          'A little flight game — fly the Kestrel-9 over the Meridian Isles.',
          '',
          ...missionLines,
          '',
          'Fly: arrow keys bank and climb · Shift / Ctrl throttle',
          'Mouse: hold and move sideways to steer',
          'Best score: ' + state.best,
        ],
        'Press 1, 2 or 3 — or click — to fly',
      );
    } else if (state.screen === SCREEN_PAUSED) {
      drawOverlay('Paused', ['The islands will wait for you.'], 'Press P or Space to keep flying');
    } else if (state.screen === SCREEN_OVER) {
      drawOverlay(
        'Flight Over',
        [state.reason || 'The Kestrel-9 is down.', 'Score: ' + state.course.score, 'Best: ' + state.best],
        'Press Space to fly again',
        COLOURS.gaugeRed,
      );
    } else if (state.screen === SCREEN_DONE) {
      drawOverlay(
        'Mission Complete!',
        [
          state.reason || 'Flown clean over the Meridian Isles.',
          'Rings ' + state.course.ringsHit + ' / ' + state.course.rings.length + '  ·  Parcels ' + state.course.parcelsHit + ' / ' + state.course.parcels.length,
          'Score: ' + state.course.score + '   ·   Time: ' + Math.round(state.plane.timeS) + ' s',
          'Best: ' + state.best,
        ],
        'Press Space to fly again',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
