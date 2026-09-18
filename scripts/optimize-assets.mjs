#!/usr/bin/env node
// Milo asset pipeline: analyse, optimise and validate every project asset.
//
//   npm run assets:optimize                 build assets/ from assets-original/
//   npm run assets:optimize -- --no-cache   re-encode everything from scratch
//   npm run assets:check                    validate assets/ + manifest, no writes
//
// Safety model
//   - Originals (config.sourceDir) are only ever read; they are the single
//     source of truth, so re-running never re-compresses already compressed files.
//   - The new output is built in a staging directory, fully validated, and only
//     then swapped in place of config.outputDir.
//   - Files in the current output directory that are neither outputs of the
//     previous run nor byte-identical copies of originals block the swap
//     (--force overrides).

import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from './assets.config.mjs';
import { analyzeAudio, buildAudio } from './lib/audio.mjs';
import {
  buildFromEntry,
  buildManifest,
  manifestEntries,
  renderMarkdown,
  STATUS,
} from './lib/report.mjs';
import { buildSvg, inspectSvg, SVGO_VERSION } from './lib/svg.mjs';
import {
  exists,
  formatBytes,
  KEBAB_CASE,
  mapLimit,
  reductionPercent,
  run,
  sha256,
  suspiciousNameReason,
  toKebabCase,
  walkFiles,
  WorkerPool,
} from './lib/util.mjs';
import { validateOutput } from './lib/validate.mjs';

const PIPELINE_VERSION = '1.0.0';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STAGING_MARKER = '.pipeline-staging';
const IMAGE_WORKER = new URL('./lib/images.mjs', import.meta.url);
const KIND_BY_EXT = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  avif: 'image',
  tif: 'image',
  tiff: 'image',
  svg: 'svg',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  caf: 'audio',
  aif: 'audio',
  aiff: 'audio',
  json: 'data',
};

const HELP = `Milo asset pipeline

Usage: node scripts/optimize-assets.mjs [options]

  --check             validate ${config.outputDir}/ against ${config.reports.json} and the originals (no writes)
  --no-cache          ignore the previous manifest and re-encode everything
  --force             replace ${config.outputDir}/ even if it contains unknown files
  --concurrency <n>   image worker threads (default: CPU count - 2, max 8)
  -h, --help          show this help
`;

function parseArgs(argv) {
  const opts = {
    check: false,
    cache: true,
    force: false,
    help: false,
    concurrency: Math.max(1, Math.min(8, os.availableParallelism() - 2)),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--no-cache') opts.cache = false;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--concurrency')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
      opts.concurrency = Math.max(1, Number.parseInt(value, 10) || 1);
    } else throw new Error(`Unknown option: ${arg}\n\n${HELP}`);
  }
  return opts;
}

const paths = {
  source: resolve(ROOT, config.sourceDir),
  output: resolve(ROOT, config.outputDir),
  staging: resolve(ROOT, config.stagingDir),
  markdown: resolve(ROOT, config.reports.markdown),
  json: resolve(ROOT, config.reports.json),
};

function assertLayout() {
  const within = (child, parent) => child === parent || child.startsWith(parent + sep);
  if (within(paths.output, paths.source) || within(paths.source, paths.output))
    throw new Error('sourceDir and outputDir must not overlap');
  if (within(paths.staging, paths.source) || within(paths.staging, paths.output))
    throw new Error('stagingDir must be outside sourceDir and outputDir');
}

async function detectTools() {
  const version = async (cmd, args, pattern) => {
    try {
      const { stdout, stderr } = await run(cmd, args);
      return `${stdout}\n${stderr}`.match(pattern)?.[1] ?? null;
    } catch {
      return null;
    }
  };
  const tools = {
    sharp: sharp.versions.sharp,
    libvips: sharp.versions.vips,
    libwebp: sharp.versions.webp,
    pngquant: await version('pngquant', ['--version'], /^\s*(\d[\w.-]*)/),
    oxipng: await version('oxipng', ['--version'], /oxipng\s+(\S+)/),
    svgo: SVGO_VERSION,
    ffmpeg: await version('ffmpeg', ['-version'], /ffmpeg version (\S+)/),
    ffprobe: await version('ffprobe', ['-version'], /ffprobe version (\S+)/),
  };
  const missing = ['pngquant', 'oxipng', 'ffmpeg', 'ffprobe'].filter((t) => !tools[t]);
  if (missing.length) {
    const formulas = [...new Set(missing.map((t) => (t === 'ffprobe' ? 'ffmpeg' : t)))];
    throw new Error(
      `Missing CLI tools: ${missing.join(', ')}\nInstall with: brew install ${formulas.join(' ')}`,
    );
  }
  return tools;
}

async function readPreviousManifest() {
  if (!(await exists(paths.json))) return null;
  try {
    const manifest = JSON.parse(await readFile(paths.json, 'utf8'));
    const items = manifestEntries(manifest);
    return {
      manifest,
      items,
      bySource: new Map(items.map((i) => [i.entry.original.file, i.entry])),
    };
  } catch (error) {
    console.warn(`! Ignoring unreadable ${config.reports.json}: ${error.message}`);
    return null;
  }
}

// ------------------------------------------------------------ discovery

async function discoverSources() {
  if (!(await exists(paths.source))) {
    throw new Error(
      `${config.sourceDir}/ not found. Originals must live there (copy the original assets first).`,
    );
  }
  const warnings = [];
  const assets = [];
  for (const rel of await walkFiles(paths.source)) {
    const parts = rel.split('/');
    const folder = parts.length > 1 ? parts[0] : '';
    let category = config.categories[folder];
    if (!category) {
      const dir = toKebabCase(folder);
      category = {
        key: folder ? dir.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase()) : 'other',
        dir,
      };
      warnings.push(
        `${rel}: folder "${folder || '(root)'}" is not mapped in assets.config.mjs → "${dir || '(root)'}"`,
      );
    }
    const ext = extname(rel).slice(1).toLowerCase();
    const kind = KIND_BY_EXT[ext] ?? 'other';
    if (kind === 'other') warnings.push(`${rel}: unknown type ".${ext}", copied unchanged`);
    const originalBaseName = basename(rel, extname(rel));
    const buf = await readFile(join(paths.source, rel));
    assets.push({
      sourceRel: rel,
      sourcePath: join(paths.source, rel),
      sourceExt: ext,
      sourceBytes: buf.length,
      sourceSha256: sha256(buf),
      kind,
      category: { key: category.key, dir: category.dir, sourceFolder: folder },
      subDir: parts.slice(1, -1).map(toKebabCase).join('/'),
      id: toKebabCase(originalBaseName),
      originalBaseName,
      flags: new Set(),
      notes: [],
    });
  }
  return { assets, warnings };
}

function excludeExactDuplicates(assets) {
  const bySha = new Map();
  const excluded = [];
  const kept = [];
  for (const asset of assets) {
    const first = bySha.get(asset.sourceSha256);
    if (first) {
      excluded.push({
        source: `${config.sourceDir}/${asset.sourceRel}`,
        duplicateOf: `${config.sourceDir}/${first.sourceRel}`,
        reason: 'exact binary duplicate (SHA-256)',
      });
    } else {
      bySha.set(asset.sourceSha256, asset);
      kept.push(asset);
    }
  }
  return { kept, excluded };
}

function assignOutputNames(assets) {
  const errors = [];
  const byPath = new Map();
  for (const asset of assets) {
    if (!KEBAB_CASE.test(asset.id))
      errors.push(`${asset.sourceRel}: cannot derive a kebab-case name`);
    const suspicious = suspiciousNameReason(asset.id);
    if (suspicious)
      addFinding(
        asset,
        null,
        `Имя выглядит случайным (${suspicious}) — стоит переименовать оригинал.`,
      );
    asset.registryId = asset.subDir ? `${asset.subDir}/${asset.id}` : asset.id;
    asset.outputRelNoExt = [asset.category.dir, asset.subDir, asset.id].filter(Boolean).join('/');
    const clash = byPath.get(asset.outputRelNoExt);
    if (clash)
      errors.push(
        `${asset.sourceRel} and ${clash.sourceRel} both map to ${config.outputDir}/${asset.outputRelNoExt}.* — rename one original`,
      );
    else byPath.set(asset.outputRelNoExt, asset);
  }
  if (errors.length) throw new Error(`Naming conflicts:\n  ${errors.join('\n  ')}`);
}

// ------------------------------------------------------------ settings & flags

function resolveImageSettings(asset) {
  const img = config.image;
  const defaults = img.categoryDefaults[asset.category.key] ?? {
    profile: 'scene',
    expectAlpha: false,
  };
  const override = img.files[asset.sourceRel] ?? {};
  const profileName = override.profile ?? defaults.profile;
  const profile = img.profiles[profileName];
  if (!profile) throw new Error(`${asset.sourceRel}: unknown image profile "${profileName}"`);
  const { width: sw, height: sh } = asset.analysis;
  const scale = Math.min(
    1,
    profile.maxWidth ? profile.maxWidth / sw : 1,
    profile.maxHeight ? profile.maxHeight / sh : 1,
  );
  return {
    profile: profileName,
    profileReason: profile.reason,
    expectAlpha: override.expectAlpha ?? defaults.expectAlpha,
    forceFormat: override.format ?? null,
    sourceWidth: sw,
    sourceHeight: sh,
    width: Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
    keepAlpha: asset.analysis.alphaUsed,
    webp: img.webp,
    png: img.png,
    gate: img.gate,
    formatPolicy: img.formatPolicy,
  };
}

function settingsHash(asset, tools) {
  const s = asset.settings;
  const pick = (...names) => Object.fromEntries(names.map((n) => [n, tools[n]]));
  const payload = {
    image: () => ({
      tools: pick('sharp', 'libvips', 'libwebp', 'pngquant', 'oxipng'),
      settings: {
        sw: s.sourceWidth,
        sh: s.sourceHeight,
        w: s.width,
        h: s.height,
        alpha: s.keepAlpha,
        format: s.forceFormat,
        webp: s.webp,
        png: s.png,
        gate: s.gate,
        policy: s.formatPolicy,
      },
    }),
    svg: () => ({
      tools: pick('svgo', 'sharp', 'libvips'),
      settings: {
        renderSize: config.svg.renderSize,
        removeTitleAndDesc: config.svg.removeTitleAndDesc,
        gate: config.svg.gate,
      },
    }),
    audio: () => {
      const { review, files, ...encoding } = config.audio;
      return {
        tools: pick('ffmpeg'),
        settings: { ...encoding, override: files[asset.sourceRel] ?? null },
      };
    },
  }[asset.kind]?.() ?? { copy: true };
  return sha256(JSON.stringify({ v: PIPELINE_VERSION, kind: asset.kind, ...payload })).slice(0, 16);
}

const BACKGROUND_LABEL = {
  white: 'белый фон',
  black: 'чёрный фон',
  'solid-color': 'сплошной цветной фон',
  checkerboard: 'нарисованная пикселями «шахматка» прозрачности',
  scene: 'непрозрачный фон/сцена',
};

// A note belongs to the status it explains (flag), or is informational (null).
function addFinding(asset, flag, text) {
  if (flag) asset.flags.add(flag);
  asset.notes.push({ flag: flag ?? null, text });
}

function applyImageFlags(asset) {
  const a = asset.analysis;
  const s = asset.settings;
  if (s.expectAlpha && (a.transparency === 'opaque' || a.transparency === 'opaque-border')) {
    const bg = BACKGROUND_LABEL[a.background] ?? 'непрозрачный фон';
    addFinding(
      asset,
      STATUS.ALPHA,
      a.hasAlphaChannel && a.alphaUsed
        ? `Альфа-канал есть, но фон по краям полностью непрозрачный — похоже на: ${bg}. Автоматическое удаление фона не выполнялось.`
        : `Нет прозрачности — ${bg} записан пикселями. Автоматическое удаление фона не выполнялось.`,
    );
  }
  if (a.transparency === 'feathered') {
    addFinding(
      asset,
      STATUS.ALPHA,
      `Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю ${a.alpha.ringMeanAlpha}/255). Alpha сохранена бит-в-бит.`,
    );
  }
  if (!s.expectAlpha && a.alphaUsed)
    addFinding(
      asset,
      null,
      'Есть прозрачность, хотя для этой категории она не ожидается; сохранена.',
    );
  if (a.hasAlphaChannel && !a.alphaUsed)
    addFinding(
      asset,
      null,
      'Альфа-канал был полностью непрозрачным и удалён (визуально без изменений).',
    );
}

function applySvgFlags(asset) {
  const s = asset.analysis;
  if (s.hasText) {
    addFinding(
      asset,
      STATUS.VISUAL,
      `Содержит <text> (font-family: ${s.textFonts.join('; ') || 'не задан'}). react-native-svg рисует текст системным шрифтом: на Android нет Arial/Helvetica, надпись будет выглядеть иначе. Лучше перевести текст в кривые (outline) в редакторе.`,
    );
  }
  if (s.hasImage)
    addFinding(asset, STATUS.VISUAL, 'Содержит встроенный растр <image> — это не чистый вектор.');
  if (s.hasFilter || s.hasForeignObject || s.hasScript) {
    addFinding(
      asset,
      STATUS.VISUAL,
      'Содержит <filter>/<foreignObject>/<script> — react-native-svg поддерживает это ограниченно или не поддерживает.',
    );
  }
  if (!s.viewBox)
    addFinding(asset, STATUS.VISUAL, 'Нет viewBox — иконка не будет корректно масштабироваться.');
}

function applyAudioFlags(audioAssets) {
  const peaks = audioAssets
    .map((a) => a.analysis.pcm.peakDb)
    .filter((p) => p != null)
    .sort((x, y) => x - y);
  const medianPeak = peaks.length ? peaks[Math.floor(peaks.length / 2)] : null;
  const r = config.audio.review;
  for (const asset of audioAssets) {
    const { pcm, clipped } = asset.analysis;
    if (pcm.silent) {
      addFinding(
        asset,
        STATUS.AUDIO,
        `Файл полностью тихий (ниже ${config.audio.silenceThresholdDb} dBFS).`,
      );
      continue;
    }
    if (clipped) {
      addFinding(
        asset,
        STATUS.AUDIO,
        `Клиппинг в исходнике: пик ${pcm.peakDb} dBFS, ${pcm.overs} сэмплов ≥ 0 dBFS, до ${pcm.maxRunNearFullScale} сэмплов подряд у 0 dBFS. Не перекодировался — скопирован байт-в-байт.`,
      );
    }
    if (pcm.peakDb < r.quietPeakDb) {
      addFinding(
        asset,
        STATUS.AUDIO,
        `Очень тихий: пик ${pcm.peakDb} dBFS, RMS ${pcm.rmsDb} dBFS (медианный пик набора ${medianPeak} dBFS). Громкость не менялась.`,
      );
    }
    if (pcm.trailingSilenceMs < 1 && pcm.endRmsDb != null && pcm.endRmsDb > r.abruptEndDb) {
      addFinding(
        asset,
        null,
        `Резкий обрыв в конце: последние 10 мс звучат на ${pcm.endRmsDb} dBFS без затухания — возможен щелчок. Не исправлялось.`,
      );
    }
  }
}

function applyContentDuplicateFlags(assets) {
  const note = (asset, text) => addFinding(asset, STATUS.DUPLICATE, text);
  const images = assets.filter((a) => a.kind === 'image');
  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      const [a, b] = [images[i], images[j]];
      if (a.analysis.pixelHash === b.analysis.pixelHash) {
        note(a, `Пиксельно идентичен ${b.sourceRel} (файлы различаются только кодированием).`);
        note(b, `Пиксельно идентичен ${a.sourceRel} (файлы различаются только кодированием).`);
        continue;
      }
      let distance = 0;
      for (let k = 0; k < a.analysis.dHash.length; k++)
        if (a.analysis.dHash[k] !== b.analysis.dHash[k]) distance++;
      if (distance <= config.image.nearDuplicateMaxDistance) {
        note(
          a,
          `Визуально почти совпадает с ${b.sourceRel} (dHash distance ${distance}/256) — возможно, старая версия.`,
        );
        note(
          b,
          `Визуально почти совпадает с ${a.sourceRel} (dHash distance ${distance}/256) — возможно, старая версия.`,
        );
      }
    }
  }
  const byPcm = new Map();
  for (const asset of assets.filter((a) => a.kind === 'audio')) {
    const other = byPcm.get(asset.analysis.pcmHash);
    if (other) {
      note(asset, `Звучит идентично ${other.sourceRel} (одинаковый декодированный PCM).`);
      note(other, `Звучит идентично ${asset.sourceRel} (одинаковый декодированный PCM).`);
    } else byPcm.set(asset.analysis.pcmHash, asset);
  }
}

function applyManualReview(assets, warnings) {
  const known = new Set(assets.map((a) => a.sourceRel));
  for (const [rel, review] of Object.entries(config.review)) {
    if (!known.has(rel))
      warnings.push(`review entry "${rel}" in assets.config.mjs matches no original`);
  }
  for (const asset of assets) {
    const review = config.review[asset.sourceRel];
    if (!review) continue;
    for (const flag of review.flags ?? []) asset.flags.add(flag);
    if (review.note) addFinding(asset, review.flags?.[0] ?? null, review.note);
  }
}

function findMissing(allSources) {
  const present = new Set(allSources.map((a) => a.sourceRel));
  return config.expected
    .filter((rel) => !present.has(rel))
    .map((rel) => {
      const folder = rel.includes('/') ? rel.split('/')[0] : '';
      const category = config.categories[folder] ?? { key: 'other', dir: toKebabCase(folder) };
      const ext = extname(rel).slice(1).toLowerCase();
      const outExt = KIND_BY_EXT[ext] === 'image' ? '(webp|png)' : ext;
      return {
        expected: `${config.outputDir}/${[category.dir, toKebabCase(basename(rel, extname(rel)))].filter(Boolean).join('/')}.${outExt}`,
        source: `${config.sourceDir}/${rel}`,
        category: category.key,
        status: STATUS.MISSING,
      };
    });
}

// ------------------------------------------------------------ build

async function prepareStaging() {
  if (await exists(paths.staging)) {
    if (!(await exists(join(paths.staging, STAGING_MARKER)))) {
      throw new Error(
        `${config.stagingDir}/ exists but was not created by this pipeline — remove it manually.`,
      );
    }
    await rm(paths.staging, { recursive: true, force: true });
  }
  await mkdir(paths.staging, { recursive: true });
  await writeFile(
    join(paths.staging, STAGING_MARKER),
    'Temporary build directory of scripts/optimize-assets.mjs\n',
  );
}

async function tryCache(asset, previous) {
  const entry = previous?.bySource.get(`${config.sourceDir}/${asset.sourceRel}`);
  if (!entry || entry.kind !== asset.kind) return null;
  if (
    entry.original.sha256 !== asset.sourceSha256 ||
    entry.pipeline?.settingsHash !== asset.settingsHash
  )
    return null;
  if (!entry.file.startsWith(`${config.outputDir}/${asset.outputRelNoExt}.`)) return null;
  const existing = resolve(ROOT, entry.file);
  if (!(await exists(existing))) return null;
  const buf = await readFile(existing);
  if (sha256(buf) !== entry.sha256) return null;
  const target = join(paths.staging, entry.file.slice(config.outputDir.length + 1));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  return buildFromEntry(entry);
}

function logAsset(asset) {
  const b = asset.build;
  let detail = b.action ?? '';
  if (asset.kind === 'image') {
    const e = b.encoding;
    detail = `${e.codec === 'webp' ? `webp q${e.quality}` : `png ${e.mode}`} · SSIM ${b.quality.ssim}`;
  } else if (asset.kind === 'audio') {
    detail =
      b.action === 'reencoded'
        ? `mp3 ${b.encoding.vbr}${b.encoding.mono ? ' mono' : ''} · ${b.durationMs} ms`
        : `copied (${b.reason})`;
  } else if (asset.kind === 'svg') {
    detail = `${b.action} · render SSIM ${b.quality?.ssim ?? '—'}`;
  }
  const target = `${config.outputDir}/${asset.outputRel}`;
  const change = `${formatBytes(asset.sourceBytes).padStart(9)} → ${formatBytes(b.bytes).padStart(9)}  ${`-${reductionPercent(asset.sourceBytes, b.bytes)}%`.padStart(7)}`;
  console.log(`  ${asset.cached ? '·' : '✓'} ${target.padEnd(46)} ${change}  ${detail}`);
}

async function buildAll(assets, previous, pool, opts) {
  for (const asset of assets) {
    await mkdir(dirname(join(paths.staging, asset.outputRelNoExt)), { recursive: true });
  }
  const finish = (asset, build, cached = false) => {
    asset.build = build;
    asset.cached = cached;
    asset.outputRel = `${asset.outputRelNoExt}.${build.ext}`;
    logAsset(asset);
  };
  const fromCache = async (asset) => {
    if (!opts.cache) return false;
    const build = await tryCache(asset, previous);
    if (build) finish(asset, build, true);
    return Boolean(build);
  };

  const images = assets.filter((a) => a.kind === 'image');
  const audio = assets.filter((a) => a.kind === 'audio');
  const svgs = assets.filter((a) => a.kind === 'svg');
  const others = assets.filter((a) => a.kind === 'data' || a.kind === 'other');

  await Promise.all([
    ...images.map(async (asset) => {
      if (await fromCache(asset)) return;
      const build = await pool.run('encode', {
        sourcePath: asset.sourcePath,
        outputPathNoExt: join(paths.staging, asset.outputRelNoExt),
        ...asset.settings,
      });
      finish(asset, build);
    }),
    mapLimit(audio, 4, async (asset) => {
      if (await fromCache(asset)) return;
      const build = await buildAudio({
        sourcePath: asset.sourcePath,
        sourceBytes: asset.sourceBytes,
        sourceExt: asset.sourceExt,
        analysis: asset.analysis,
        outputPathNoExt: join(paths.staging, asset.outputRelNoExt),
        cfg: config.audio,
        override: config.audio.files[asset.sourceRel],
      });
      finish(asset, build);
    }),
    (async () => {
      for (const asset of svgs) {
        if (await fromCache(asset)) continue;
        const build = await buildSvg({
          sourcePath: asset.sourcePath,
          outputPath: join(paths.staging, `${asset.outputRelNoExt}.svg`),
          cfg: config.svg,
        });
        finish(asset, build);
      }
    })(),
    (async () => {
      for (const asset of others) {
        const target = join(paths.staging, `${asset.outputRelNoExt}.${asset.sourceExt}`);
        await copyFile(asset.sourcePath, target);
        finish(asset, {
          action: 'copied',
          ext: asset.sourceExt,
          format: asset.sourceExt,
          bytes: asset.sourceBytes,
          sha256: asset.sourceSha256,
          width: null,
          height: null,
          hasAlpha: null,
        });
      }
    })(),
  ]);

  // SVGs that optimise to identical markup are duplicates in disguise.
  const bySha = new Map();
  for (const asset of svgs) {
    const other = bySha.get(asset.build.sha256);
    if (other) {
      for (const [x, y] of [
        [asset, other],
        [other, asset],
      ])
        addFinding(x, STATUS.DUPLICATE, `После оптимизации идентичен ${y.sourceRel}.`);
    } else bySha.set(asset.build.sha256, asset);
  }
}

// ------------------------------------------------------------ swap

async function assertOutputReplaceable(previous, force) {
  if (!(await exists(paths.output))) return;
  const generated = new Map(
    (previous?.items ?? []).map(({ entry }) => [
      entry.file.slice(config.outputDir.length + 1),
      entry.sha256,
    ]),
  );
  const unknown = [];
  for (const rel of await walkFiles(paths.output)) {
    const hash = sha256(await readFile(join(paths.output, rel)));
    if (generated.get(rel) === hash) continue;
    const original = join(paths.source, rel);
    if ((await exists(original)) && sha256(await readFile(original)) === hash) continue;
    unknown.push(rel);
  }
  if (!unknown.length) return;
  const list = unknown.map((f) => `    ${config.outputDir}/${f}`).join('\n');
  if (force) {
    console.warn(
      `! --force: replacing ${config.outputDir}/ although these files are neither pipeline outputs nor copies of originals:\n${list}`,
    );
    return;
  }
  throw new Error(
    `Refusing to replace ${config.outputDir}/: these files are neither outputs of the previous run nor byte-identical copies of originals:\n${list}\n` +
      `Move new or edited originals into ${config.sourceDir}/ (the source of truth) and run again, or pass --force.`,
  );
}

async function swapStagingIntoOutput() {
  await rm(join(paths.staging, STAGING_MARKER), { force: true });
  const previousDir = join(dirname(paths.output), `.${basename(paths.output)}-previous`);
  await rm(previousDir, { recursive: true, force: true });
  if (await exists(paths.output)) await rename(paths.output, previousDir);
  try {
    await rename(paths.staging, paths.output);
  } catch (error) {
    if (await exists(previousDir)) await rename(previousDir, paths.output);
    throw error;
  }
  await rm(previousDir, { recursive: true, force: true });
}

// ------------------------------------------------------------ commands

function validationItems(assets) {
  return assets.map((asset) => ({
    categoryKey: asset.category.key,
    id: asset.registryId,
    outputRel: asset.outputRel,
    entry: asset.entry,
  }));
}

function printValidation(validation) {
  const total = Object.values(validation.checks).reduce((s, c) => s + c.passed + c.failed, 0);
  for (const [name, c] of Object.entries(validation.checks)) {
    console.log(
      `  ${c.failed ? '✗' : '✓'} ${name.padEnd(22)} ${String(c.passed).padStart(4)} ok${c.failed ? `, ${c.failed} failed` : ''}`,
    );
  }
  for (const e of validation.errors) console.log(`  ✗ ${e}`);
  for (const w of validation.warnings) console.log(`  ! ${w}`);
  console.log(
    `  ${validation.passed ? 'PASSED' : 'FAILED'}: ${total} checks, ${validation.errors.length} errors, ${validation.warnings.length} warnings`,
  );
}

async function commandCheck(opts) {
  const previous = await readPreviousManifest();
  if (!previous)
    throw new Error(`${config.reports.json} not found — run npm run assets:optimize first.`);
  const { assets: sources } = await discoverSources();
  const pool = new WorkerPool(IMAGE_WORKER, opts.concurrency);
  try {
    console.log(
      `Validating ${config.outputDir}/ against ${config.reports.json} and ${config.sourceDir}/ …`,
    );
    const validation = await validateOutput({
      cfg: config,
      root: ROOT,
      outputAbs: paths.output,
      items: previous.items.map((i) => ({
        ...i,
        outputRel: i.entry.file.slice(config.outputDir.length + 1),
      })),
      sources,
      excluded: previous.manifest.excluded ?? [],
      pool,
    });
    printValidation(validation);
    if (!validation.passed) process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

async function commandBuild(opts) {
  const started = Date.now();
  const tools = await detectTools();
  // Always read: the swap safety check needs it even when the cache is disabled.
  const previous = await readPreviousManifest();
  const { assets: allSources, warnings } = await discoverSources();
  const { kept: assets, excluded } = excludeExactDuplicates(allSources);

  console.log('Milo asset pipeline');
  console.log(`  source  ${config.sourceDir}/ (${allSources.length} files)`);
  console.log(`  output  ${config.outputDir}/`);
  console.log(
    `  tools   sharp ${tools.sharp} (libvips ${tools.libvips}, libwebp ${tools.libwebp}) · pngquant ${tools.pngquant} · oxipng ${tools.oxipng} · svgo ${tools.svgo} · ffmpeg ${tools.ffmpeg}`,
  );
  for (const w of warnings) console.log(`  ! ${w}`);

  const pool = new WorkerPool(IMAGE_WORKER, opts.concurrency);
  try {
    console.log('Analyzing…');
    assignOutputNames(assets);
    await Promise.all([
      ...assets
        .filter((a) => a.kind === 'image')
        .map(async (a) => {
          a.analysis = await pool.run('analyze', { sourcePath: a.sourcePath });
        }),
      mapLimit(
        assets.filter((a) => a.kind === 'audio'),
        4,
        async (a) => {
          a.analysis = await analyzeAudio(a.sourcePath, config.audio);
        },
      ),
      ...assets
        .filter((a) => a.kind === 'svg')
        .map(async (a) => {
          a.analysis = inspectSvg(await readFile(a.sourcePath, 'utf8'));
        }),
    ]);
    for (const asset of assets) {
      if (asset.kind === 'image') {
        asset.settings = resolveImageSettings(asset);
        applyImageFlags(asset);
      }
      if (asset.kind === 'svg') applySvgFlags(asset);
      asset.settingsHash = settingsHash(asset, tools);
    }
    applyAudioFlags(assets.filter((a) => a.kind === 'audio'));
    applyContentDuplicateFlags(assets);
    applyManualReview(assets, warnings);
    const missing = findMissing(allSources);

    console.log(
      `Building into ${config.stagingDir}/ (${opts.concurrency} image workers${opts.cache ? '' : ', cache disabled'})…`,
    );
    await prepareStaging();
    await buildAll(assets, previous, pool, opts);

    const settings = { image: config.image, svg: config.svg, audio: config.audio };
    // Entries first (validation reads them), then the manifest with the validation result.
    const draft = buildManifest({
      cfg: config,
      tools,
      pipelineVersion: PIPELINE_VERSION,
      assets,
      missing,
      excluded,
      validation: null,
      settings,
    });
    const draftEntries = new Map(
      manifestEntries(draft).map((i) => [i.entry.original.file, i.entry]),
    );
    for (const asset of assets)
      asset.entry = draftEntries.get(`${config.sourceDir}/${asset.sourceRel}`);

    console.log('Validating staging output…');
    const validation = await validateOutput({
      cfg: config,
      root: ROOT,
      outputAbs: paths.staging,
      items: validationItems(assets),
      sources: allSources,
      excluded,
      pool,
    });
    validation.warnings.unshift(...warnings);
    printValidation(validation);
    if (!validation.passed) {
      process.exitCode = 1;
      console.error(
        `\nValidation failed: ${config.outputDir}/ was NOT changed. Inspect ${config.stagingDir}/ and the errors above.`,
      );
      return;
    }

    await assertOutputReplaceable(previous, opts.force);
    await swapStagingIntoOutput();

    const manifest = buildManifest({
      cfg: config,
      tools,
      pipelineVersion: PIPELINE_VERSION,
      assets,
      missing,
      excluded,
      validation,
      settings,
    });
    await writeFile(paths.json, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(paths.markdown, renderMarkdown(manifest));

    const t = manifest.totals;
    const reused = assets.filter((a) => a.cached).length;
    console.log(
      `\nDone in ${((Date.now() - started) / 1000).toFixed(1)} s (${assets.length - reused} built, ${reused} reused from cache).`,
    );
    console.log(
      `  ${config.outputDir}/ updated · reports: ${config.reports.markdown}, ${config.reports.json}`,
    );
    console.log(
      `  TOTAL ${formatBytes(t.originalBytes)} → ${formatBytes(t.optimizedBytes)} (saved ${formatBytes(t.savedBytes)}, -${t.reductionPercent}%)`,
    );
    const attention = manifestEntries(manifest).filter((i) => i.entry.status !== STATUS.READY);
    if (attention.length || missing.length) {
      console.log(
        `  Needs attention: ${attention.length} assets${missing.length ? `, ${missing.length} missing` : ''} — see ${config.reports.markdown}`,
      );
    }
  } finally {
    await pool.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }
  assertLayout();
  if (opts.check) await commandCheck(opts);
  else await commandBuild(opts);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
