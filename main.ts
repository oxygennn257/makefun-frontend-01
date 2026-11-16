// funboard's entrypoint (Node 22, standard library only).
//
// The frontend lives in app/ next to this file: plain static files a browser
// opens at app/index.html, reading make.fun's public API. This program hands
// it in: it copies app/ and screenshots/ into the output directory and writes
// dossier.json there — the summary the judge reads (the screenshots, the
// first load's files and bytes, and the source) — using the kit's vendored
// library. vendor/makefun-frontend.ts must stay exactly as the kit shipped
// it: the scorer rebuilds the dossier with its own copy and compares byte
// for byte.
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Grader run: the output directory is /output.

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

async function prepareOutput() {
  // Start from an empty output directory so a stale file from an earlier
  // run can never ride along into the submission.
  await rm(destination, { recursive: true, force: true });
  await mkdir(join(destination, 'screenshots'), { recursive: true });
  await cp(join(scriptDir, 'app'), join(destination, 'app'), { recursive: true });
  await cp(join(scriptDir, 'screenshots'), join(destination, 'screenshots'), { recursive: true });
  // The entry needs exactly the 3 screenshots shots.json names: a missing
  // shot must fail loudly here, not surface as a gate failure later.
  const shots = await readdir(join(scriptDir, 'screenshots'));
  if (shots.length !== 3) {
    throw new Error(`screenshots/ holds ${shots.length} files, expected 3`);
  }
}

async function writeDossier() {
  // The gate's caps (RULES.txt, "## The gate"): the text cap shapes the
  // dossier's bytes; the others refuse an entry the scorer would refuse
  // outright.
  const dossier = buildDossier(destination, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  });
  await writeFile(join(destination, 'dossier.json'), dossier);
  return dossier;
}

async function main() {
  await prepareOutput();
  const dossier = await writeDossier();

  // Report the gate-relevant numbers of what was just written, so a failed
  // local run is visible at a glance instead of a silent dossier.json.
  // buildDossier returns bytes (a Uint8Array), not a string: decode it
  // before parsing, or JSON.parse receives a comma-separated list of byte
  // values.
  const summary = JSON.parse(new TextDecoder().decode(dossier));
  const totals = summary.text.split('\n').find((line) => line.startsWith('Totals:'));
  if (totals) console.log(totals);
  console.log(
    `screenshots: ${summary.images.length} (${summary.images.map((image) => image.name).join(', ')}); dossier bytes: ${dossier.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
