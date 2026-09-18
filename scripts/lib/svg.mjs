// SVG optimisation with SVGO, gated by a before/after render comparison.

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { optimize, VERSION as SVGO_VERSION } from 'svgo';
import { compareImages } from './image-metrics.mjs';
import { sha256 } from './util.mjs';

export { SVGO_VERSION };

function svgoConfig({ safe, removeTitleAndDesc }) {
  const overrides = {};
  if (removeTitleAndDesc) overrides.removeDesc = { removeAny: true };
  if (safe)
    Object.assign(overrides, {
      mergePaths: false,
      convertShapeToPath: false,
      convertPathData: { floatPrecision: 4 },
    });
  // SVGO 4's preset-default keeps viewBox and <title>; both are asserted below.
  return {
    multipass: true,
    plugins: [
      { name: 'preset-default', params: { overrides } },
      ...(removeTitleAndDesc ? ['removeTitle'] : []),
    ],
  };
}

export function inspectSvg(text) {
  const root = text.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const attr = (name) => root.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
  const viewBox = attr('viewBox');
  const box = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  return {
    hasRoot: Boolean(root),
    viewBox,
    width: Number.parseFloat(attr('width')) || (box ? box[2] : null),
    height: Number.parseFloat(attr('height')) || (box ? box[3] : null),
    textFonts: [...text.matchAll(/<text\b[^>]*font-family="([^"]*)"/gi)].map((m) => m[1]),
    hasText: /<text\b/i.test(text),
    hasImage: /<image\b/i.test(text),
    hasFilter: /<filter\b/i.test(text),
    hasForeignObject: /<foreignObject\b/i.test(text),
    hasScript: /<script\b/i.test(text),
    hasEditorMetadata:
      /<metadata\b/i.test(text) || /xmlns:(inkscape|sodipodi|sketch|figma|i|x)=/i.test(text),
    hasComments: /<!--/.test(text),
  };
}

export async function renderSvg(text, size, info) {
  const base = Math.max(info.width || 0, info.height || 0) || 96;
  const { data, info: out } = await sharp(Buffer.from(text), { density: (72 * size) / base })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  for (let i = 3; i < data.length; i += 4) if (data[i] < minAlpha) minAlpha = data[i];
  return { data, raw: { width: out.width, height: out.height, channels: 4 }, minAlpha };
}

export function parseSvg(text) {
  // Parses without transforming; throws on malformed XML.
  optimize(text, { plugins: [] });
}

export async function compareSvgRenders(beforeText, afterText, size) {
  const beforeInfo = inspectSvg(beforeText);
  const afterInfo = inspectSvg(afterText);
  const before = await renderSvg(beforeText, size, beforeInfo);
  const after = await renderSvg(afterText, size, afterInfo);
  if (before.raw.width !== after.raw.width || before.raw.height !== after.raw.height) {
    return { sameSize: false, metrics: null, render: after };
  }
  return {
    sameSize: true,
    metrics: compareImages(before.data, after.data, before.raw),
    render: after,
  };
}

export async function buildSvg({ sourcePath, outputPath, cfg }) {
  const sourceText = await readFile(sourcePath, 'utf8');
  const source = inspectSvg(sourceText);
  const attempts = [];

  for (const safe of [false, true]) {
    let optimized;
    try {
      optimized = optimize(sourceText, {
        path: sourcePath,
        ...svgoConfig({ safe, removeTitleAndDesc: cfg.removeTitleAndDesc }),
      }).data;
    } catch (error) {
      attempts.push({ safe, error: error.message });
      continue;
    }
    const info = inspectSvg(optimized);
    if (source.viewBox && info.viewBox !== source.viewBox) {
      attempts.push({ safe, error: 'viewBox changed or removed' });
      continue;
    }
    const { sameSize, metrics, render } = await compareSvgRenders(
      sourceText,
      optimized,
      cfg.renderSize,
    );
    const pass =
      sameSize && metrics.ssim >= cfg.gate.ssim && metrics.alphaMaxError <= cfg.gate.alphaMaxError;
    attempts.push({
      safe,
      bytes: Buffer.byteLength(optimized),
      ssim: metrics?.ssim ?? null,
      alphaMaxError: metrics?.alphaMaxError ?? null,
      pass,
    });
    if (pass) {
      await writeFile(outputPath, optimized);
      return {
        action: 'optimized',
        reason: safe
          ? 'SVGO (safe settings: no path merging, precision 4)'
          : 'SVGO preset-default, multipass',
        ext: 'svg',
        format: 'svg',
        bytes: Buffer.byteLength(optimized),
        sha256: sha256(Buffer.from(optimized)),
        width: info.width,
        height: info.height,
        viewBox: info.viewBox,
        hasAlpha: render.minAlpha < 255,
        quality: metrics,
        attempts,
        source,
      };
    }
  }

  await copyFile(sourcePath, outputPath);
  const buf = await readFile(outputPath);
  const render = await renderSvg(sourceText, cfg.renderSize, source);
  return {
    action: 'copied',
    reason: 'no SVGO result passed the render comparison; original kept',
    ext: 'svg',
    format: 'svg',
    bytes: buf.length,
    sha256: sha256(buf),
    width: source.width,
    height: source.height,
    viewBox: source.viewBox,
    hasAlpha: render.minAlpha < 255,
    quality: null,
    attempts,
    source,
  };
}
