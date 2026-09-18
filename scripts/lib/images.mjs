// Raster image jobs, executed inside worker threads (see WorkerPool in util.mjs).
//
//   analyze  - alpha usage, transparency class, content bbox, hashes
//   encode   - resize, search the WebP quality ladder, build PNG alternatives,
//              pick a format, write the file
//   verify   - independently decode the written file and re-measure it against
//              a freshly rendered reference

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMainThread, parentPort } from 'node:worker_threads';
import sharp from 'sharp';
import { compareImages } from './image-metrics.mjs';
import { run, sha256 } from './util.mjs';

sharp.cache(false);
sharp.concurrency(1); // parallelism comes from the worker pool

const EXACT = { ssim: 1, ssimP1: 1, ssimChroma: 1, psnr: 99, alphaMaxError: 0, alphaMeanError: 0 };
const RING = 16; // px, border ring used to characterise the background

export const passesGate = (m, gate) =>
  m.ssim >= gate.ssim &&
  m.ssimP1 >= gate.ssimP1 &&
  m.ssimChroma >= gate.ssimChroma &&
  m.alphaMaxError <= gate.alphaMaxError;

async function analyze({ sourcePath }) {
  const input = await readFile(sourcePath);
  const meta = await sharp(input).metadata();
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;

  let transparent = 0;
  let opaque = 0;
  let visible = 0;
  let soft = 0;
  let minAlpha = 255;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p++) {
      const a = data[p * 4 + 3];
      if (a < minAlpha) minAlpha = a;
      if (a === 0) transparent++;
      else {
        visible++;
        if (a < 240) soft++;
        if (a === 255) opaque++;
      }
      if (a > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Border ring: how the "background" of the canvas looks.
  let ringTotal = 0;
  let ringAlphaSum = 0;
  let ringOpaque = 0;
  let neutral = 0;
  const sum = [0, 0, 0];
  const sumSq = [0, 0, 0];
  const lumaBins = new Uint32Array(64);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= RING && x < w - RING && y >= RING && y < h - RING) continue;
      const i = (y * w + x) * 4;
      ringTotal++;
      ringAlphaSum += data[i + 3];
      if (data[i + 3] < 250) continue;
      ringOpaque++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      sumSq[0] += r * r;
      sumSq[1] += g * g;
      sumSq[2] += b * b;
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 12) {
        neutral++;
        lumaBins[Math.min(63, Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 4))]++;
      }
    }
  }
  const ringMeanAlpha = ringAlphaSum / ringTotal;
  const ringOpaquePct = (100 * ringOpaque) / ringTotal;

  let background = null;
  if (ringOpaquePct >= 90) {
    const mean = sum.map((s) => s / ringOpaque);
    const sd = sumSq.map((s, c) => Math.sqrt(Math.max(0, s / ringOpaque - mean[c] ** 2)));
    const bins = [...lumaBins.entries()].sort((a, b) => b[1] - a[1]);
    const brightness = (mean[0] + mean[1] + mean[2]) / 3;
    if ((sd[0] + sd[1] + sd[2]) / 3 < 8) {
      background = brightness >= 220 ? 'white' : brightness <= 35 ? 'black' : 'solid-color';
    } else if (
      neutral / ringOpaque >= 0.8 &&
      (bins[0][1] + bins[1][1]) / ringOpaque >= 0.7 &&
      Math.abs(bins[0][0] - bins[1][0]) >= 3
    ) {
      background = 'checkerboard';
    } else {
      background = 'scene';
    }
  }

  const alphaUsed = Boolean(meta.hasAlpha) && minAlpha < 255;
  let transparency;
  if (!alphaUsed) transparency = 'opaque';
  else if (ringOpaquePct >= 90) transparency = 'opaque-border';
  else if ((100 * transparent) / n < 1 && ringMeanAlpha >= 32) transparency = 'feathered';
  else if (visible && soft / visible >= 0.5) transparency = 'soft';
  else transparency = 'cutout';

  const grey = await sharp(input)
    .flatten({ background: '#808080' })
    .greyscale()
    .resize(17, 16, { fit: 'fill' })
    .raw()
    .toBuffer();
  let dHash = '';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) dHash += grey[y * 17 + x] < grey[y * 17 + x + 1] ? '1' : '0';
  }

  return {
    format: meta.format,
    width: w,
    height: h,
    channels: meta.channels,
    hasAlphaChannel: Boolean(meta.hasAlpha),
    alphaUsed,
    transparency,
    background,
    alpha: {
      transparentPct: round((100 * transparent) / n),
      opaquePct: round((100 * opaque) / n),
      softPct: round((100 * soft) / n),
      minAlpha,
      ringMeanAlpha: round(ringMeanAlpha, 1),
      ringOpaquePct: round(ringOpaquePct, 1),
    },
    contentBox:
      maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    metadata: { icc: Boolean(meta.icc), exif: Boolean(meta.exif), xmp: Boolean(meta.xmp) },
    pixelHash: sha256(Buffer.concat([Buffer.from(`${w}x${h}:`), data])),
    dHash,
  };
}

async function renderReference(input, job) {
  let pipeline = sharp(input);
  if (job.width !== job.sourceWidth || job.height !== job.sourceHeight) {
    pipeline = pipeline.resize(job.width, job.height, { fit: 'fill', kernel: 'lanczos3' });
  }
  pipeline = job.keepAlpha ? pipeline.ensureAlpha() : pipeline.removeAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  // Never pass `info` back as raw input options: it carries premultiplied: true.
  return { data, raw: { width: info.width, height: info.height, channels: info.channels } };
}

async function decodeRaw(buf, keepAlpha) {
  let pipeline = sharp(buf);
  pipeline = keepAlpha ? pipeline.ensureAlpha() : pipeline.removeAlpha();
  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

async function encode(job) {
  const input = await readFile(job.sourcePath);
  const { data: ref, raw } = await renderReference(input, job);
  const tmp = await mkdtemp(join(tmpdir(), 'milo-img-'));

  const measure = async (buf) => {
    const { data, info } = await decodeRaw(buf, job.keepAlpha);
    if (info.width !== raw.width || info.height !== raw.height || info.channels !== raw.channels) {
      throw new Error(
        `decoded candidate is ${info.width}x${info.height}/${info.channels}, expected ${raw.width}x${raw.height}/${raw.channels}`,
      );
    }
    return compareImages(ref, data, raw);
  };

  try {
    const candidates = [];

    // 1. WebP: lowest ladder quality that passes the gate.
    const tried = new Map();
    const tryWebp = async (quality) => {
      if (!tried.has(quality)) {
        const buf = await sharp(ref, { raw })
          .webp({
            quality,
            alphaQuality: job.webp.alphaQuality,
            effort: job.webp.effort,
            smartSubsample: job.webp.smartSubsample,
          })
          .toBuffer();
        const metrics = await measure(buf);
        const candidate = {
          label: `webp q${quality}`,
          codec: 'webp',
          quality,
          buf,
          bytes: buf.length,
          metrics,
          pass: passesGate(metrics, job.gate),
        };
        tried.set(quality, candidate);
        candidates.push(candidate);
      }
      return tried.get(quality);
    };
    const ladder = [...job.webp.ladder].sort((a, b) => a - b);
    let index = ladder.indexOf(job.webp.start);
    if (index < 0) index = ladder.length - 1;
    let webp = null;
    const first = await tryWebp(ladder[index]);
    if (first.pass) {
      webp = first;
      for (let i = index - 1; i >= 0; i--) {
        const lower = await tryWebp(ladder[i]);
        if (!lower.pass) break;
        webp = lower;
      }
    } else {
      for (let i = index + 1; i < ladder.length && !webp; i++) {
        const higher = await tryWebp(ladder[i]);
        if (higher.pass) webp = higher;
      }
    }
    if (!webp) {
      const buf = await sharp(ref, { raw })
        .webp({ lossless: true, effort: job.webp.effort })
        .toBuffer();
      const metrics = await measure(buf);
      webp = {
        label: 'webp lossless',
        codec: 'webp',
        quality: 'lossless',
        buf,
        bytes: buf.length,
        metrics,
        pass: passesGate(metrics, job.gate),
      };
      candidates.push(webp);
    }

    // 2. PNG: palette (pngquant) if it passes the gate, otherwise lossless.
    const referencePng = join(tmp, 'reference.png');
    await sharp(ref, { raw })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(referencePng);
    const palettePng = join(tmp, 'palette.png');
    await run('pngquant', [
      '--force',
      '--speed',
      String(job.png.pngquantSpeed),
      '--strip',
      '--output',
      palettePng,
      '--',
      referencePng,
    ]);
    await run('oxipng', ['-o', String(job.png.oxipngLevel), '--strip', 'safe', '-q', palettePng]);
    const paletteBuf = await readFile(palettePng);
    const paletteMetrics = await measure(paletteBuf);
    let png = {
      label: 'png8 (pngquant + oxipng)',
      codec: 'png',
      mode: 'png8',
      buf: paletteBuf,
      bytes: paletteBuf.length,
      metrics: paletteMetrics,
      pass: passesGate(paletteMetrics, job.gate),
    };
    candidates.push(png);
    if (!png.pass) {
      await run('oxipng', [
        '-o',
        String(job.png.oxipngLevel),
        '--strip',
        'safe',
        '-q',
        referencePng,
      ]);
      const buf = await readFile(referencePng);
      png = {
        label: 'png lossless (oxipng)',
        codec: 'png',
        mode: 'lossless',
        buf,
        bytes: buf.length,
        metrics: EXACT,
        pass: true,
      };
      candidates.push(png);
    }

    // 3. Format decision.
    const policy = job.formatPolicy;
    const savings = png.bytes - webp.bytes;
    const webpWins =
      webp.pass &&
      savings >= Math.max(policy.minAbsoluteSavingsBytes, png.bytes * policy.minRelativeSavings);
    const smallerPct = Math.round((100 * savings) / png.bytes);
    let chosen;
    let decision;
    if (job.forceFormat === 'webp') {
      chosen = webp;
      decision = 'format forced to WebP in config';
    } else if (job.forceFormat === 'png') {
      chosen = png;
      decision = 'format forced to PNG in config';
    } else if (webpWins) {
      chosen = webp;
      decision = `${webp.label} is ${smallerPct}% smaller than ${png.label}`;
    } else {
      chosen = png;
      decision = `${webp.label} is not substantially smaller than ${png.label} (${smallerPct}%)`;
    }

    const ext = chosen.codec;
    await writeFile(`${job.outputPathNoExt}.${ext}`, chosen.buf);
    return {
      ext,
      format: ext,
      bytes: chosen.bytes,
      sha256: sha256(chosen.buf),
      width: raw.width,
      height: raw.height,
      hasAlpha: job.keepAlpha,
      encoding:
        chosen.codec === 'webp'
          ? {
              codec: 'webp',
              quality: chosen.quality,
              alphaQuality: job.keepAlpha ? job.webp.alphaQuality : null,
              effort: job.webp.effort,
              smartSubsample: job.webp.smartSubsample,
            }
          : { codec: 'png', mode: chosen.mode },
      quality: chosen.metrics,
      decision,
      candidates: candidates.map((c) => ({
        label: c.label,
        bytes: c.bytes,
        pass: c.pass,
        ssim: c.metrics.ssim,
        ssimP1: c.metrics.ssimP1,
        ssimChroma: c.metrics.ssimChroma,
        alphaMaxError: c.metrics.alphaMaxError,
      })),
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function verify(job) {
  const buf = await readFile(job.outputPath);
  const meta = await sharp(buf).metadata();
  const { data, info } = await decodeRaw(buf, job.keepAlpha);
  const input = await readFile(job.sourcePath);
  const sourceMeta = await sharp(input).metadata();
  const sourceStats = sourceMeta.hasAlpha ? await sharp(input).stats() : null;
  const { data: ref, raw } = await renderReference(input, job);
  const sameSize =
    info.width === raw.width && info.height === raw.height && info.channels === raw.channels;
  let minAlpha = 255;
  if (job.keepAlpha) {
    for (let i = 3; i < data.length; i += 4) if (data[i] < minAlpha) minAlpha = data[i];
  }
  return {
    format: meta.format,
    width: meta.width,
    height: meta.height,
    hasAlphaChannel: Boolean(meta.hasAlpha),
    minAlpha,
    sourceAlphaUsed: Boolean(sourceStats && sourceStats.channels[3].min < 255),
    metrics: sameSize ? compareImages(ref, data, raw) : null,
  };
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

const handlers = { analyze, encode, verify };

if (!isMainThread && parentPort) {
  parentPort.on('message', async ({ id, type, payload }) => {
    try {
      const result = await handlers[type](payload);
      parentPort.postMessage({ id, ok: true, result });
    } catch (error) {
      parentPort.postMessage({
        id,
        ok: false,
        error: `${type} ${payload?.sourcePath ?? ''}: ${error.stack || error}`,
      });
    }
  });
}
