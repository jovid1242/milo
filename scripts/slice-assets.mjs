#!/usr/bin/env node
// Cuts sprite sheets into separate originals, as set in assets.config.mjs → slices.
//
//   npm run assets:slice      then   npm run assets:optimize
//
// The sheet itself is never modified. Each part is written next to it in the
// source folder as a lossless PNG and from then on is an original like any
// other: the pipeline optimises, validates and registers it. Re-running gives
// byte-identical files, so the pipeline cache is not invalidated.

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from './assets.config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, config.sourceDir);

const inside = (rect, width, height) =>
  rect.left >= 0 &&
  rect.top >= 0 &&
  rect.left + rect.width <= width &&
  rect.top + rect.height <= height;

async function slicePart(sheetPath, meta, target, part) {
  if (!inside(part, meta.width, meta.height))
    throw new Error(`${target}: rect lies outside the ${meta.width}×${meta.height} sheet`);

  const { data, info } = await sharp(sheetPath)
    .extract({ left: part.left, top: part.top, width: part.width, height: part.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // `erase` clears what must not be part of the asset (e.g. a caption that
  // touches the art). Rects are in sheet pixels, like the crop itself.
  for (const rect of part.erase ?? []) {
    const left = Math.max(rect.left - part.left, 0);
    const top = Math.max(rect.top - part.top, 0);
    const right = Math.min(rect.left + rect.width - part.left, info.width);
    const bottom = Math.min(rect.top + rect.height - part.top, info.height);
    if (left >= right || top >= bottom) throw new Error(`${target}: erase rect misses the crop`);
    for (let y = top; y < bottom; y++)
      data.fill(0, (y * info.width + left) * 4, (y * info.width + right) * 4);
  }

  const output = join(SOURCE, target);
  await mkdir(dirname(output), { recursive: true });
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
  console.log(`✓ ${config.sourceDir}/${target} (${info.width}×${info.height})`);
}

async function main() {
  const sheets = Object.entries(config.slices ?? {});
  if (!sheets.length) {
    console.log('No slices configured.');
    return;
  }
  for (const [sheet, parts] of sheets) {
    const sheetPath = join(SOURCE, sheet);
    const meta = await sharp(sheetPath).metadata();
    for (const [target, part] of Object.entries(parts)) {
      if (target === sheet) throw new Error(`${sheet}: a part cannot overwrite its sheet`);
      await slicePart(sheetPath, meta, target, part);
    }
  }
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
