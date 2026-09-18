// Post-build validation. Used on the staging directory before it replaces the
// output directory, and on the output directory by `--check`.

import { readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { probeAudio } from './audio.mjs';
import { compareSvgRenders, inspectSvg, parseSvg } from './svg.mjs';
import { KEBAB_CASE, mapLimit, run, sha256, walkFiles } from './util.mjs';

class Checks {
  constructor() {
    this.checks = {};
    this.errors = [];
    this.warnings = [];
  }
  #get(name) {
    return (this.checks[name] ??= { passed: 0, failed: 0 });
  }
  pass(name) {
    this.#get(name).passed++;
  }
  fail(name, message) {
    this.#get(name).failed++;
    this.errors.push(`[${name}] ${message}`);
  }
  warn(message) {
    this.warnings.push(message);
  }
  result() {
    return {
      passed: this.errors.length === 0,
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}

const passesImageGate = (m, gate) =>
  m.ssim >= gate.ssim &&
  m.ssimP1 >= gate.ssimP1 &&
  m.ssimChroma >= gate.ssimChroma &&
  m.alphaMaxError <= gate.alphaMaxError;

/**
 * @param items   [{ categoryKey, id, outputRel, entry }] — entry as in assets-manifest.json
 * @param sources [{ sourceRel, sourceSha256 }] — current originals
 */
export async function validateOutput({ cfg, root, outputAbs, items, sources, excluded, pool }) {
  const c = new Checks();
  const fileOf = (item) => join(outputAbs, item.outputRel);
  const sourceOf = (item) => join(root, item.entry.original.file);

  // Files on disk <-> manifest
  const onDisk = new Set(await walkFiles(outputAbs));
  const listed = new Set(items.map((i) => i.outputRel));
  for (const f of onDisk)
    if (!listed.has(f)) c.fail('manifestMatchesFiles', `${f}: file is not listed in the manifest`);
  const present = [];
  for (const item of items) {
    if (!onDisk.has(item.outputRel)) {
      c.fail('outputFilesExist', `${item.outputRel}: missing`);
      continue;
    }
    c.pass('outputFilesExist');
    const buf = await readFile(fileOf(item));
    if (buf.length !== item.entry.size || sha256(buf) !== item.entry.sha256) {
      c.fail(
        'manifestMatchesFiles',
        `${item.outputRel}: size or SHA-256 differs from the manifest`,
      );
    } else {
      c.pass('manifestMatchesFiles');
    }
    present.push(item);
  }

  // Raster images: decode, dimensions, alpha, quality (independent re-measure)
  const gate = cfg.image.gate;
  await Promise.all(
    present
      .filter((i) => i.entry.kind === 'image')
      .map(async (item) => {
        const e = item.entry;
        let v;
        try {
          v = await pool.run('verify', {
            sourcePath: sourceOf(item),
            outputPath: fileOf(item),
            sourceWidth: e.original.width,
            sourceHeight: e.original.height,
            width: e.width,
            height: e.height,
            keepAlpha: e.hasAlpha,
          });
        } catch (error) {
          c.fail('imagesDecode', `${item.outputRel}: ${error.message.split('\n')[0]}`);
          return;
        }
        if (v.format !== e.format)
          c.fail(
            'imagesDecode',
            `${item.outputRel}: decodes as ${v.format}, manifest says ${e.format}`,
          );
        else c.pass('imagesDecode');

        if (!(v.width > 0 && v.height > 0) || v.width !== e.width || v.height !== e.height) {
          c.fail(
            'dimensionsValid',
            `${item.outputRel}: ${v.width}x${v.height}, manifest says ${e.width}x${e.height}`,
          );
        } else {
          c.pass('dimensionsValid');
        }

        if (v.sourceAlphaUsed) {
          if (e.hasAlpha && v.hasAlphaChannel && v.minAlpha < 255 && v.metrics?.alphaMaxError === 0)
            c.pass('alphaPreserved');
          else
            c.fail(
              'alphaPreserved',
              `${item.outputRel}: original has transparency, output alpha is missing or altered (max error ${v.metrics?.alphaMaxError})`,
            );
        }

        if (!v.metrics || !passesImageGate(v.metrics, gate)) {
          const m = v.metrics;
          c.fail(
            'qualityGate',
            `${item.outputRel}: ${m ? `SSIM ${m.ssim}, p1 ${m.ssimP1}, chroma ${m.ssimChroma}, alpha max error ${m.alphaMaxError}` : 'size mismatch'}`,
          );
        } else {
          c.pass('qualityGate');
        }
      }),
  );

  // SVG: well-formed XML, viewBox kept, renders like the original
  for (const item of present.filter((i) => i.entry.kind === 'svg')) {
    const text = await readFile(fileOf(item), 'utf8');
    try {
      parseSvg(text);
    } catch (error) {
      c.fail('svgValid', `${item.outputRel}: invalid SVG/XML (${error.message.split('\n')[0]})`);
      continue;
    }
    const sourceText = await readFile(sourceOf(item), 'utf8');
    const info = inspectSvg(text);
    const sourceInfo = inspectSvg(sourceText);
    if (!info.hasRoot || (sourceInfo.viewBox && info.viewBox !== sourceInfo.viewBox)) {
      c.fail('svgValid', `${item.outputRel}: missing <svg> root or viewBox changed`);
      continue;
    }
    c.pass('svgValid');
    const { sameSize, metrics, render } = await compareSvgRenders(
      sourceText,
      text,
      cfg.svg.renderSize,
    );
    if (!(render.raw.width > 0 && render.raw.height > 0))
      c.fail('dimensionsValid', `${item.outputRel}: renders to 0 px`);
    else c.pass('dimensionsValid');
    if (
      !sameSize ||
      metrics.ssim < cfg.svg.gate.ssim ||
      metrics.alphaMaxError > cfg.svg.gate.alphaMaxError
    ) {
      c.fail(
        'qualityGate',
        `${item.outputRel}: render differs from original (SSIM ${metrics?.ssim}, alpha max error ${metrics?.alphaMaxError})`,
      );
    } else {
      c.pass('qualityGate');
    }
  }

  // Audio: ffprobe + full decode without errors
  await mapLimit(
    present.filter((i) => i.entry.kind === 'audio'),
    4,
    async (item) => {
      const p = item.entry.audio.production;
      let probe;
      try {
        probe = await probeAudio(fileOf(item));
      } catch (error) {
        c.fail(
          'audioReadable',
          `${item.outputRel}: ffprobe failed (${error.message.split('\n')[0]})`,
        );
        return;
      }
      const { stderr } = await run(
        'ffmpeg',
        ['-v', 'error', '-i', fileOf(item), '-f', 'null', '-'],
        { allowFailure: true },
      );
      if (stderr.trim())
        c.fail(
          'audioReadable',
          `${item.outputRel}: decode errors: ${stderr.trim().split('\n')[0]}`,
        );
      else if (
        !(probe.durationMs > 0) ||
        probe.channels !== p.channels ||
        probe.sampleRate !== p.sampleRate
      ) {
        c.fail(
          'audioReadable',
          `${item.outputRel}: ${probe.channels} ch / ${probe.sampleRate} Hz / ${probe.durationMs} ms does not match the manifest`,
        );
      } else {
        c.pass('audioReadable');
      }
    },
  );

  // Data files: valid and byte-identical to the original
  for (const item of present.filter((i) => i.entry.kind === 'data' || i.entry.kind === 'other')) {
    const buf = await readFile(fileOf(item));
    if (item.entry.format === 'json') {
      try {
        JSON.parse(buf.toString('utf8'));
      } catch (error) {
        c.fail('dataValid', `${item.outputRel}: invalid JSON (${error.message})`);
        continue;
      }
    }
    const original = await readFile(sourceOf(item)).catch(() => null);
    if (!original || sha256(original) !== sha256(buf))
      c.fail('dataValid', `${item.outputRel}: differs from ${item.entry.original.file}`);
    else c.pass('dataValid');
  }

  // Naming
  const names = new Map();
  const ids = new Map();
  for (const item of items) {
    const name = basename(item.outputRel);
    const ext = extname(name).slice(1);
    const id = basename(name, extname(name));
    const problems = [];
    for (const segment of item.outputRel.split('/').slice(0, -1))
      if (!KEBAB_CASE.test(segment)) problems.push(`folder "${segment}" is not kebab-case`);
    if (!KEBAB_CASE.test(id)) problems.push('name is not kebab-case');
    if (ext !== item.entry.format)
      problems.push(`extension .${ext} does not match format ${item.entry.format}`);
    if (names.has(name)) problems.push(`file name also used by ${names.get(name)}`);
    else names.set(name, item.outputRel);
    const key = `${item.categoryKey}/${item.id}`;
    if (ids.has(key)) problems.push(`asset id "${item.id}" also used by ${ids.get(key)}`);
    else ids.set(key, item.outputRel);
    if (problems.length) c.fail('filenames', `${item.outputRel}: ${problems.join('; ')}`);
    else c.pass('filenames');
  }

  // Every original is represented; originals unchanged since the build
  const produced = new Map(items.map((i) => [i.entry.original.file, i]));
  const excludedSet = new Set(excluded.map((x) => x.source));
  for (const source of sources) {
    const rel = `${cfg.sourceDir}/${source.sourceRel}`;
    const item = produced.get(rel);
    if (item || excludedSet.has(rel)) c.pass('sourcesAccountedFor');
    else c.fail('sourcesAccountedFor', `${rel}: no production output`);
    if (item && item.entry.original.sha256 !== source.sourceSha256) {
      c.warn(`${rel} changed after ${item.outputRel} was built — run npm run assets:optimize`);
    }
  }
  const sourceSet = new Set(sources.map((s) => `${cfg.sourceDir}/${s.sourceRel}`));
  for (const item of items) {
    if (!sourceSet.has(item.entry.original.file))
      c.fail(
        'sourcesAccountedFor',
        `${item.outputRel}: original ${item.entry.original.file} no longer exists`,
      );
  }

  return c.result();
}
