// Meridian Skies, handed in: a Node 22 program, standard library only, that
// carries the finished game to the grader. It copies this repository's game/
// and screenshots/ beside it into the output directory and writes the
// dossier the judge reads, built with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself while building it with `node serve.ts`, then open
// http://localhost:8080 in a desktop browser.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error('game/ is missing: the repository holds no playable game to hand in');
}
if (!existsSync(shotsDir) || readdirSync(shotsDir).filter((name) => !name.startsWith('.')).length < 3) {
  throw new Error('screenshots/ holds fewer than 3 renders of the game');
}

mkdirSync(targetDir, { recursive: true });
cpSync(gameDir, join(targetDir, 'game'), { recursive: true });
mkdirSync(join(targetDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(targetDir, 'screenshots'), { recursive: true });

// The scorer's own caps, from the bounty gate: only text_max_bytes shapes
// the dossier's bytes; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files in game/
// or 48 MiB of game files in all, or a path under game/ over 1000 bytes.
const dossier = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(targetDir, 'dossier.json'), dossier);
console.log(`Meridian Skies handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes) in ${targetDir}`);
