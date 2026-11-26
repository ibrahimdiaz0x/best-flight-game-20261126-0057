# Meridian Skies — A Little Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/ibrahimdiaz0x/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/ibrahimdiaz0x/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Fly the **Kestrel-9**, a little courier plane, over the **Meridian Isles** — a
chain of patchwork fields, a winding river, a harbour town and two runways —
in a chase view with a lit instrument panel under your thumbs.

## The three sorties

| Key | Mission | The job |
|-----|---------|---------|
| `1` | **Ring Run** | Thread 8 golden rings over Meridian Bay. |
| `2` | **Island Hop** | Take off from Meridian Field and land clean on Coral Runway. |
| `3` | **Courier Dash** | Collect 6 parcels before the fuel runs dry — and mind the storm cells. |

Flying rewards throttle and turn discipline: bank to turn, pitch to trade
speed for altitude, watch the fuel gauge, and never let the speed fall under
the stall. Landings are judged — gentle, slow and lined up, or it counts as
a crash.

## Controls

- **← / →** or **A / D** — bank left and right
- **↑ / ↓** or **W / S** — climb and descend
- **Shift / Ctrl** — throttle up and down
- **Mouse** — hold and move sideways to steer
- **Space** — start / fly again · **P** — pause · **R** — restart the sortie

The HUD shows altitude, airspeed and heading at the top; the panel below
shows an artificial horizon, altimeter, airspeed dial, compass tape, fuel
and throttle bars, and stall and low-fuel lamps.

## Play it

```sh
node serve.ts
# open http://localhost:8080 in a desktop browser
```

No build step, no network request: `game/` is plain static files.

## Hand it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are real renders of the game's own code, staged with
`?shot=start|play|land&seed=7&mission=…` (see `shots.json`).

## Layout

- `game/index.html` — the page; `game/src/main.js` boots the loop
- `game/src/config.js` — tuning, missions, colours
- `game/src/chance.js` — seeded random source
- `game/src/islands.js` — the Meridian Isles: river, road, town, runways
- `game/src/kestrel.js` — the Kestrel-9's flight model and landing judge
- `game/src/course.js` — rings, parcels, storms and progress
- `game/src/controls.js` — keyboard and mouse
- `game/src/painter.js` — everything drawn: sky, terrain, plane, HUD, panel
- `game/src/staging.js` — the autopilot behind the screenshots

Built for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).
Original game: its own idea, art, sounds and names.
