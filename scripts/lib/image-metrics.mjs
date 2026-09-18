// Objective image-quality metrics used to gate lossy compression.
//
// SSIM (Wang et al. 2004) with 8x8 box windows computed via running sums, so a
// 1.5 MP image costs a few ms per plane. Transparent images are compared as
// composites over the app background (#FFFFFF) and a dark surface (#151716);
// the worse of the two results counts. Fully transparent regions are excluded
// from every mean so empty canvas cannot inflate the score.

const WIN = 8;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

export const BACKGROUNDS = {
  light: [255, 255, 255],
  dark: [0x15, 0x17, 0x16],
};

// Box-filter mean over a WIN x WIN window (clamped at the borders).
function boxMean(src, w, h) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const r0 = Math.floor(WIN / 2);
  const r1 = WIN - r0 - 1;
  const prefix = new Float64Array(w + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) prefix[x + 1] = prefix[x] + src[row + x];
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r0);
      const b = Math.min(w - 1, x + r1);
      tmp[row + x] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
    }
  }
  const col = new Float64Array(h + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y + 1] = col[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const a = Math.max(0, y - r0);
      const b = Math.min(h - 1, y + r1);
      out[y * w + x] = (col[b + 1] - col[a]) / (b - a + 1);
    }
  }
  return out;
}

function ssimMap(x, y, w, h) {
  const n = w * h;
  const xx = new Float32Array(n);
  const yy = new Float32Array(n);
  const xy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xx[i] = x[i] * x[i];
    yy[i] = y[i] * y[i];
    xy[i] = x[i] * y[i];
  }
  const mx = boxMean(x, w, h);
  const my = boxMean(y, w, h);
  const sxx = boxMean(xx, w, h);
  const syy = boxMean(yy, w, h);
  const sxy = boxMean(xy, w, h);
  const map = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vx = sxx[i] - mx[i] * mx[i];
    const vy = syy[i] - my[i] * my[i];
    const cxy = sxy[i] - mx[i] * my[i];
    map[i] =
      ((2 * mx[i] * my[i] + C1) * (2 * cxy + C2)) /
      ((mx[i] * mx[i] + my[i] * my[i] + C1) * (vx + vy + C2));
  }
  return map;
}

// Composite RGBA over a solid background into Y'CbCr planes (BT.709, 8-bit range).
function toYCbCr(rgba, w, h, channels, bg) {
  const n = w * h;
  const Y = new Float32Array(n);
  const Cb = new Float32Array(n);
  const Cr = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += channels) {
    const a = channels === 4 ? rgba[p + 3] / 255 : 1;
    const r = rgba[p] * a + bg[0] * (1 - a);
    const g = rgba[p + 1] * a + bg[1] * (1 - a);
    const b = rgba[p + 2] * a + bg[2] * (1 - a);
    const yv = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    Y[i] = yv;
    Cb[i] = (b - yv) / 1.8556 + 128;
    Cr[i] = (r - yv) / 1.5748 + 128;
  }
  return { Y, Cb, Cr };
}

function contentMask(rgba, w, h, channels) {
  const n = w * h;
  const mask = new Uint8Array(n);
  if (channels !== 4) return mask.fill(1);
  for (let i = 0; i < n; i++) mask[i] = rgba[i * 4 + 3] >= 8 ? 1 : 0;
  return mask;
}

function maskedMean(map, mask) {
  let s = 0;
  let c = 0;
  for (let i = 0; i < map.length; i++) {
    if (mask[i]) {
      s += map[i];
      c++;
    }
  }
  return c ? s / c : 1;
}

// 1st percentile of 32x32 block means: catches local damage (text, edges)
// that a global mean hides.
function blockPercentile(map, mask, w, h, block = 32, pct = 0.01) {
  const scores = [];
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let s = 0;
      let c = 0;
      let total = 0;
      for (let y = by; y < Math.min(h, by + block); y++) {
        for (let x = bx; x < Math.min(w, bx + block); x++) {
          const i = y * w + x;
          total++;
          if (mask[i]) {
            s += map[i];
            c++;
          }
        }
      }
      if (c >= total / 2) scores.push(s / c);
    }
  }
  if (!scores.length) return 1;
  scores.sort((a, b) => a - b);
  return scores[Math.min(scores.length - 1, Math.floor(scores.length * pct))];
}

/**
 * Compare a decoded candidate against the lossless reference (same size).
 * Both buffers are raw, 8-bit, interleaved, with the same channel count.
 */
export function compareImages(ref, test, { width: w, height: h, channels }) {
  if (ref.length !== test.length) throw new Error('compareImages: buffer size mismatch');
  const mask = contentMask(ref, w, h, channels);
  const backgrounds = channels === 4 ? Object.values(BACKGROUNDS) : [[0, 0, 0]];

  let ssim = 1;
  let ssimP1 = 1;
  let ssimChroma = 1;
  let psnr = Infinity;
  for (const bg of backgrounds) {
    const r = toYCbCr(ref, w, h, channels, bg);
    const t = toYCbCr(test, w, h, channels, bg);
    const mapY = ssimMap(r.Y, t.Y, w, h);
    ssim = Math.min(ssim, maskedMean(mapY, mask));
    ssimP1 = Math.min(ssimP1, blockPercentile(mapY, mask, w, h));
    const mapCb = ssimMap(r.Cb, t.Cb, w, h);
    const mapCr = ssimMap(r.Cr, t.Cr, w, h);
    ssimChroma = Math.min(ssimChroma, (maskedMean(mapCb, mask) + maskedMean(mapCr, mask)) / 2);

    let se = 0;
    let c = 0;
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      const d = r.Y[i] - t.Y[i];
      se += d * d;
      c++;
    }
    const mse = c ? se / c : 0;
    psnr = Math.min(psnr, mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse));
  }

  let alphaMaxError = 0;
  let alphaMeanError = 0;
  if (channels === 4) {
    let sum = 0;
    for (let i = 3; i < ref.length; i += 4) {
      const d = Math.abs(ref[i] - test[i]);
      sum += d;
      if (d > alphaMaxError) alphaMaxError = d;
    }
    alphaMeanError = sum / (w * h);
  }

  return {
    ssim: round(ssim, 5),
    ssimP1: round(ssimP1, 5),
    ssimChroma: round(ssimChroma, 5),
    psnr: Number.isFinite(psnr) ? round(psnr, 2) : 99,
    alphaMaxError,
    alphaMeanError: round(alphaMeanError, 4),
  };
}

function round(v, digits) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
