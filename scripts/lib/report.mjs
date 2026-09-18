// Builds assets-manifest.json (machine-readable) and ASSET_MANIFEST.md (human
// report). The Markdown is rendered from the JSON manifest only.

import { formatBytes, reductionPercent } from './util.mjs';

export const STATUS = {
  READY: 'READY',
  MISSING: 'MISSING',
  VISUAL: 'VISUAL_REVIEW_REQUIRED',
  AUDIO: 'AUDIO_REVIEW_REQUIRED',
  ALPHA: 'NEEDS_ALPHA_REVIEW',
  DUPLICATE: 'DUPLICATE_REVIEW_REQUIRED',
};
const STATUS_ORDER = [
  STATUS.MISSING,
  STATUS.VISUAL,
  STATUS.AUDIO,
  STATUS.ALPHA,
  STATUS.DUPLICATE,
  STATUS.READY,
];
export const sortFlags = (flags) =>
  [...flags].sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
export const primaryStatus = (flags) => STATUS_ORDER.find((s) => flags.includes(s)) ?? STATUS.READY;

const KIND_LABEL = {
  image: 'Растровые изображения',
  svg: 'SVG',
  audio: 'Звуки',
  data: 'Прочее (JSON)',
  other: 'Прочее',
};
const TRANSPARENCY_LABEL = {
  cutout: 'alpha · вырезка',
  soft: 'alpha · мягкое свечение',
  feathered: 'alpha · растушёванная сцена',
  'opaque-border': 'alpha, но фон непрозрачный',
  opaque: 'нет (непрозрачное)',
};
const CHECK_LABEL = {
  outputFilesExist: 'Каждый output-файл существует',
  manifestMatchesFiles: 'Manifest соответствует файлам (размер, SHA-256, нет лишних)',
  imagesDecode: 'Каждое изображение декодируется, формат верный',
  dimensionsValid: 'Размеры не нулевые и совпадают с manifest',
  alphaPreserved: 'Alpha сохранена там, где была (бит-в-бит)',
  qualityGate: 'Качество не ниже гейта (SSIM против оригинала / рендера)',
  svgValid: 'SVG валидны (XML, viewBox, рендер)',
  audioReadable: 'Аудио читается ffprobe и декодируется без ошибок',
  dataValid: 'JSON валиден и идентичен оригиналу',
  filenames: 'Имена в kebab-case, уникальны, расширение = формат',
  sourcesAccountedFor: 'Каждый оригинал учтён',
};

export function buildEntry(asset, cfg) {
  const b = asset.build;
  const a = asset.analysis;
  const flags = sortFlags(asset.flags);
  const originalFormat =
    { image: a?.format, svg: 'svg', audio: a?.probe?.codec }[asset.kind] ?? asset.sourceExt;
  const entry = {
    file: `${cfg.outputDir}/${asset.outputRel}`,
    format: b.format,
    width: b.width ?? null,
    height: b.height ?? null,
    size: b.bytes,
    hasAlpha: asset.kind === 'image' || asset.kind === 'svg' ? Boolean(b.hasAlpha) : null,
    status: primaryStatus(flags),
    flags,
    notes: asset.notes,
    kind: asset.kind,
    transparency: asset.kind === 'image' ? a.transparency : asset.kind === 'svg' ? 'vector' : null,
    sha256: b.sha256,
    reductionPercent: reductionPercent(asset.sourceBytes, b.bytes),
    renamed: asset.id !== asset.originalBaseName,
    original: {
      file: `${cfg.sourceDir}/${asset.sourceRel}`,
      format: originalFormat,
      width: asset.kind === 'image' || asset.kind === 'svg' ? a.width : null,
      height: asset.kind === 'image' || asset.kind === 'svg' ? a.height : null,
      size: asset.sourceBytes,
      sha256: asset.sourceSha256,
    },
  };

  if (asset.kind === 'image') {
    const s = asset.settings;
    entry.image = {
      profile: s.profile,
      profileReason: s.profileReason,
      resized: s.width !== s.sourceWidth || s.height !== s.sourceHeight,
      maxCrispSizePt: { width: Math.floor(b.width / 3), height: Math.floor(b.height / 3) },
      encoding: b.encoding,
      quality: b.quality,
      decision: b.decision,
      candidates: b.candidates,
      source: {
        background: a.background,
        alpha: a.alpha,
        contentBox: a.contentBox,
        metadata: a.metadata,
      },
    };
  } else if (asset.kind === 'svg') {
    entry.svg = {
      viewBox: b.viewBox,
      action: b.action,
      reason: b.reason,
      quality: b.quality,
      attempts: b.attempts,
      source: {
        hasText: a.hasText,
        textFonts: a.textFonts,
        hasComments: a.hasComments,
        hasEditorMetadata: a.hasEditorMetadata,
      },
    };
  } else if (asset.kind === 'audio') {
    const { probe, pcm, loudness } = a;
    entry.durationMs = b.durationMs;
    entry.audio = {
      action: b.action,
      reason: b.reason,
      original: {
        codec: probe.codec,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        bitrateKbps: probe.bitrateKbps,
        durationMs: pcm.durationMs,
        peakDb: pcm.peakDb,
        truePeakDb: loudness.truePeakDb,
        rmsDb: pcm.rmsDb,
        integratedLufs: loudness.integratedLufs,
        overs: pcm.overs,
        maxRunNearFullScale: pcm.maxRunNearFullScale,
        leadingSilenceMs: pcm.leadingSilenceMs,
        trailingSilenceMs: pcm.trailingSilenceMs,
        endRmsDb: pcm.endRmsDb,
        stereo: pcm.stereo,
        tags: probe.tags,
      },
      production: {
        codec: b.codec,
        sampleRate: b.sampleRate,
        channels: b.channels,
        bitrateKbps: b.bitrateKbps,
        durationMs: b.durationMs,
        ...b.output,
      },
      encoding: b.encoding,
      checks: b.checks,
    };
  }
  entry.pipeline = { settingsHash: asset.settingsHash };
  return entry;
}

// Inverse of buildEntry for the cache: the build result stored in a previous manifest.
export function buildFromEntry(entry) {
  const base = {
    ext: entry.file.split('.').pop(),
    format: entry.format,
    bytes: entry.size,
    sha256: entry.sha256,
    width: entry.width,
    height: entry.height,
    hasAlpha: entry.hasAlpha,
  };
  if (entry.kind === 'image') {
    const i = entry.image;
    return {
      ...base,
      encoding: i.encoding,
      quality: i.quality,
      decision: i.decision,
      candidates: i.candidates,
    };
  }
  if (entry.kind === 'svg') {
    const s = entry.svg;
    return {
      ...base,
      action: s.action,
      reason: s.reason,
      viewBox: s.viewBox,
      quality: s.quality,
      attempts: s.attempts,
    };
  }
  if (entry.kind === 'audio') {
    const { codec, sampleRate, channels, bitrateKbps, durationMs, ...output } =
      entry.audio.production;
    return {
      ...base,
      action: entry.audio.action,
      reason: entry.audio.reason,
      codec,
      sampleRate,
      channels,
      bitrateKbps,
      durationMs,
      encoding: entry.audio.encoding,
      checks: entry.audio.checks,
      output,
    };
  }
  return { ...base, action: 'copied' };
}

export function manifestEntries(manifest) {
  const out = [];
  for (const [key, value] of Object.entries(manifest)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [id, entry] of Object.entries(value)) {
      if (entry && typeof entry === 'object' && typeof entry.file === 'string' && entry.original)
        out.push({ categoryKey: key, id, entry });
    }
  }
  return out;
}

export function computeTotals(entries) {
  const byKind = {};
  const all = { files: 0, originalBytes: 0, optimizedBytes: 0 };
  for (const { entry } of entries) {
    const k = (byKind[entry.kind] ??= { files: 0, originalBytes: 0, optimizedBytes: 0 });
    for (const bucket of [k, all]) {
      bucket.files++;
      bucket.originalBytes += entry.original.size;
      bucket.optimizedBytes += entry.size;
    }
  }
  const finish = (t) => ({
    ...t,
    savedBytes: t.originalBytes - t.optimizedBytes,
    reductionPercent: reductionPercent(t.originalBytes, t.optimizedBytes),
  });
  return {
    ...finish(all),
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, finish(v)])),
  };
}

export function buildManifest({
  cfg,
  tools,
  pipelineVersion,
  assets,
  missing,
  excluded,
  validation,
  settings,
}) {
  const manifest = {
    schemaVersion: 1,
    app: cfg.app,
    generator: 'scripts/optimize-assets.mjs',
    pipelineVersion,
    sourceDir: cfg.sourceDir,
    outputDir: cfg.outputDir,
    tools,
    settings,
    totals: null,
    validation,
  };
  const keys = [
    ...new Set([
      ...Object.values(cfg.categories).map((c) => c.key),
      ...assets.map((a) => a.category.key),
    ]),
  ];
  const sorted = [...assets].sort((x, y) => x.outputRel.localeCompare(y.outputRel));
  for (const key of keys) {
    const inCategory = sorted.filter((a) => a.category.key === key);
    if (!inCategory.length) continue;
    manifest[key] = Object.fromEntries(inCategory.map((a) => [a.registryId, buildEntry(a, cfg)]));
  }
  manifest.missing = missing;
  manifest.excluded = excluded;
  manifest.totals = computeTotals(manifestEntries(manifest));
  return manifest;
}

// ---------------------------------------------------------------- Markdown

const fmt = (v, digits = 1) => (v == null ? '—' : Number(v).toFixed(digits));
const dims = (w, h) => (w && h ? `${w}×${h}` : '—');
const formatLabel = (f) =>
  ({ png: 'PNG', webp: 'WebP', svg: 'SVG', mp3: 'MP3', json: 'JSON', jpeg: 'JPEG' })[f] ??
  String(f).toUpperCase();
const code = (s) => `\`${s}\``;
const cell = (s) =>
  String(s ?? '—')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

function table(headers, rows, align) {
  const sep = headers.map((_, i) => (align?.[i] === 'r' ? '---:' : '---'));
  return [
    `| ${headers.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
    '',
  ];
}

function transparencyLabel(entry) {
  if (entry.kind === 'svg') return entry.hasAlpha ? 'вектор · прозрачный фон' : 'вектор';
  if (entry.kind !== 'image') return '—';
  return TRANSPARENCY_LABEL[entry.transparency] ?? entry.transparency;
}

export function renderMarkdown(manifest) {
  const items = manifestEntries(manifest).sort((a, b) => a.entry.file.localeCompare(b.entry.file));
  const t = manifest.totals;
  const v = manifest.validation;
  const L = [];

  L.push(`# Asset manifest — ${manifest.app}`, '');
  L.push(
    '> Сгенерировано командой `npm run assets:optimize` (`scripts/optimize-assets.mjs`). Не редактируйте вручную: решения правятся в `scripts/assets.config.mjs`, после чего пайплайн перезапускается.',
    `> Оригиналы (source of truth, не изменяются): ${code(`${manifest.sourceDir}/`)} → production: ${code(`${manifest.outputDir}/`)}. Машиночитаемая версия: ${code('assets-manifest.json')}.`,
    '',
  );

  // Summary
  L.push('## Итог', '');
  const kindRows = Object.entries(t.byKind)
    .sort(
      ([a], [b]) =>
        ['image', 'svg', 'audio', 'data', 'other'].indexOf(a) -
        ['image', 'svg', 'audio', 'data', 'other'].indexOf(b),
    )
    .map(([kind, k]) => [
      KIND_LABEL[kind] ?? kind,
      k.files,
      formatBytes(k.originalBytes),
      formatBytes(k.optimizedBytes),
      formatBytes(k.savedBytes),
      `${k.reductionPercent}%`,
    ]);
  kindRows.push([
    '**Всего**',
    `**${t.files}**`,
    `**${formatBytes(t.originalBytes)}**`,
    `**${formatBytes(t.optimizedBytes)}**`,
    `**${formatBytes(t.savedBytes)}**`,
    `**${t.reductionPercent}%**`,
  ]);
  L.push(
    ...table(['Тип', 'Файлов', 'Оригиналы', 'Production', 'Сэкономлено', 'Уменьшение'], kindRows, [
      null,
      'r',
      'r',
      'r',
      'r',
      'r',
    ]),
  );
  L.push(
    '```',
    `TOTAL ORIGINAL SIZE    ${formatBytes(t.originalBytes).padStart(10)}   (${t.originalBytes} bytes)`,
    `TOTAL OPTIMIZED SIZE   ${formatBytes(t.optimizedBytes).padStart(10)}   (${t.optimizedBytes} bytes)`,
    `TOTAL SAVED            ${formatBytes(t.savedBytes).padStart(10)}   (${t.savedBytes} bytes)`,
    `TOTAL REDUCTION        ${`${t.reductionPercent}%`.padStart(10)}`,
    '```',
    '',
  );
  const checkCount = Object.values(v.checks).reduce((s, c) => s + c.passed + c.failed, 0);
  L.push(
    `**Валидация:** ${v.passed ? '✅ пройдена' : '❌ есть ошибки'} — ${checkCount} проверок, ошибок: ${v.errors.length}, предупреждений: ${v.warnings.length} (подробности в разделе «Валидация»).`,
    '',
  );

  // Attention
  L.push('## Требует внимания', '');
  const flaggedCount = items.filter(({ entry }) => entry.flags.length).length;
  L.push(
    `Ассетов с флагами: **${flaggedCount}** из ${items.length}${manifest.missing.length ? `, отсутствует: **${manifest.missing.length}**` : ''}. Один ассет может иметь несколько флагов.`,
    '',
  );
  const perFlag = (status) => items.filter(({ entry }) => entry.flags.includes(status)).length;
  L.push(
    ...table(
      ['Status', 'Ассетов'],
      [
        ...(manifest.missing.length ? [[code(STATUS.MISSING), manifest.missing.length]] : []),
        ...[STATUS.VISUAL, STATUS.AUDIO, STATUS.ALPHA, STATUS.DUPLICATE]
          .filter(perFlag)
          .map((s) => [code(s), perFlag(s)]),
        [code(STATUS.READY), items.length - flaggedCount],
      ],
      [null, 'r'],
    ),
  );
  if (manifest.missing.length) {
    L.push(`### ${STATUS.MISSING} (${manifest.missing.length})`, '');
    for (const m of manifest.missing)
      L.push(`- ${code(m.expected)} — ожидается, но не найден (${code(m.source)}).`);
    L.push('');
  }
  for (const status of [STATUS.VISUAL, STATUS.AUDIO, STATUS.ALPHA, STATUS.DUPLICATE]) {
    const flagged = items.filter(({ entry }) => entry.flags.includes(status));
    if (!flagged.length) continue;
    L.push(`### ${status} (${flagged.length})`, '');
    for (const { entry } of flagged) {
      const others = entry.flags.filter((f) => f !== status);
      L.push(`- ${code(entry.file)}${others.length ? ` _(также: ${others.join(', ')})_` : ''}`);
      for (const note of entry.notes.filter((n) => n.flag === status)) L.push(`  - ${note.text}`);
    }
    L.push('');
  }
  const info = items.filter(({ entry }) => entry.notes.some((n) => n.flag === null));
  if (info.length) {
    L.push('### Заметки без статуса (низкий приоритет)', '');
    for (const { entry } of info) {
      L.push(
        `- ${code(entry.file)} — ${entry.notes
          .filter((n) => n.flag === null)
          .map((n) => n.text)
          .join(' ')}`,
      );
    }
    L.push('');
  }

  // Full table
  L.push('## Все ассеты', '');
  L.push(
    ...table(
      [
        'Asset',
        'Category',
        'Original format',
        'Production format',
        'Original dimensions',
        'Production dimensions',
        'Original size',
        'Production size',
        'Reduction %',
        'Transparency',
        'Status',
      ],
      items.map(({ categoryKey, entry }) => [
        code(entry.file.slice(manifest.outputDir.length + 1)),
        categoryKey,
        formatLabel(entry.original.format),
        formatLabel(entry.format),
        dims(entry.original.width, entry.original.height),
        dims(entry.width, entry.height),
        formatBytes(entry.original.size),
        formatBytes(entry.size),
        `${entry.reductionPercent}%`,
        transparencyLabel(entry),
        entry.flags.length ? entry.flags.join(' + ') : entry.status,
      ]),
      [null, null, null, null, 'r', 'r', 'r', 'r', 'r', null, null],
    ),
  );

  // Renames
  L.push('## Переименования и перемещения (OLD → NEW)', '');
  const moved = items.filter(
    ({ entry }) =>
      entry.original.file.slice(manifest.sourceDir.length + 1) !==
      entry.file.slice(manifest.outputDir.length + 1),
  );
  const renamedOnly = moved.filter(({ entry }) => entry.renamed);
  if (renamedOnly.length) {
    L.push('Изменено имя файла (приведение к kebab-case):', '');
    L.push(
      ...table(
        ['OLD', 'NEW'],
        renamedOnly.map(({ entry }) => [code(entry.original.file), code(entry.file)]),
      ),
    );
  } else {
    L.push('Имена файлов не менялись.', '');
  }
  const folderMap = new Map();
  for (const { entry } of moved) {
    const from = entry.original.file.split('/').slice(0, -1).join('/');
    const to = entry.file.split('/').slice(0, -1).join('/');
    if (from.slice(manifest.sourceDir.length) !== to.slice(manifest.outputDir.length))
      folderMap.set(`${from}/`, `${to}/`);
  }
  if (folderMap.size) {
    L.push('Переименованные папки:', '');
    L.push(
      ...table(
        ['OLD', 'NEW'],
        [...folderMap].map(([a, b]) => [code(a), code(b)]),
      ),
    );
  }
  L.push('<details><summary>Полный mapping всех путей</summary>', '');
  L.push(
    ...table(
      ['OLD', 'NEW'],
      moved.map(({ entry }) => [code(entry.original.file), code(entry.file)]),
    ),
  );
  L.push('</details>', '');

  // PNG -> WebP
  const converted = items.filter(
    ({ entry }) => entry.kind === 'image' && entry.original.format !== entry.format,
  );
  L.push(`## Конвертация PNG → WebP (${converted.length})`, '');
  if (converted.length) {
    L.push(
      'Для каждого файла выбрано минимальное качество WebP, прошедшее гейт; PNG-альтернатива — лучший PNG, прошедший тот же гейт (palette PNG, если проходит, иначе lossless). Alpha кодируется без потерь.',
      '',
    );
    L.push(
      ...table(
        [
          'Asset',
          'WebP quality',
          'SSIM',
          'SSIM p1',
          'Alpha',
          'Лучший PNG',
          'PNG',
          'WebP',
          'WebP меньше PNG на',
        ],
        converted.map(({ entry }) => {
          const i = entry.image;
          const pngs = i.candidates.filter((c) => c.label.startsWith('png') && c.pass);
          const bestPng = pngs.sort((a, b) => a.bytes - b.bytes)[0];
          return [
            code(entry.file.slice(manifest.outputDir.length + 1)),
            i.encoding.quality,
            fmt(i.quality.ssim, 4),
            fmt(i.quality.ssimP1, 4),
            entry.hasAlpha ? 'бит-в-бит' : '—',
            bestPng ? bestPng.label : '—',
            bestPng ? formatBytes(bestPng.bytes) : '—',
            formatBytes(entry.size),
            bestPng ? `${reductionPercent(bestPng.bytes, entry.size)}%` : '—',
          ];
        }),
        [null, 'r', 'r', 'r', null, null, 'r', 'r', 'r'],
      ),
    );
  }
  const keptPng = items.filter(({ entry }) => entry.kind === 'image' && entry.format === 'png');
  if (keptPng.length) {
    L.push('Оставлены в PNG:', '');
    for (const { entry } of keptPng) L.push(`- ${code(entry.file)} — ${entry.image.decision}`);
    L.push('');
  }

  // Resolution
  const images = items.filter(({ entry }) => entry.kind === 'image');
  const resized = images.filter(({ entry }) => entry.image.resized);
  L.push(`## Изменение разрешения (${resized.length} из ${images.length})`, '');
  L.push(
    'Размеры считаются для телефонов: самый широкий iPhone — 440pt (1320px @3x); ширина контента с отступами 20pt — 400pt (1200px @3x). «Чёткий до» — максимальный размер отображения без апскейла на экране @3x.',
    '',
  );
  L.push(
    ...table(
      ['Asset', 'Было', 'Стало', 'Профиль', 'Чёткий до (@3x)'],
      images.map(({ entry }) => [
        code(entry.file.slice(manifest.outputDir.length + 1)),
        dims(entry.original.width, entry.original.height),
        entry.image.resized
          ? `**${dims(entry.width, entry.height)}**`
          : `${dims(entry.width, entry.height)} (без изменений)`,
        `${entry.image.profile} — ${entry.image.profileReason}`,
        `${entry.image.maxCrispSizePt.width}×${entry.image.maxCrispSizePt.height} pt`,
      ]),
      [null, 'r', 'r', null, 'r'],
    ),
  );

  // Audio
  const sounds = items.filter(({ entry }) => entry.kind === 'audio');
  if (sounds.length) {
    L.push(`## Звуки (${sounds.length})`, '');
    L.push(
      'Громкость не нормализовалась. Тишина обрезается только очевидная (в начале ≥ 40 мс, в конце ≥ 150 мс ниже −60 dBFS), с сохранением короткого запаса; моно — только если стерео-разница неслышима (корреляция ≥ 0.999 и side ≤ −35 dB относительно mid).',
      '',
    );
    L.push(
      ...table(
        [
          'Sound',
          'Длительность, мс',
          'Битрейт, kbps',
          'Каналы',
          'Sample rate',
          'Пик / true peak, dBFS',
          'RMS, dBFS / LUFS',
          'Клиппинг',
          'Тишина начало / конец, мс',
          'Действие',
          'Размер',
          'Status',
        ],
        sounds.map(({ entry }) => {
          const o = entry.audio.original;
          const p = entry.audio.production;
          const e = entry.audio.encoding;
          const arrow = (a, b, d = 0) => (a === b ? fmt(a, d) : `${fmt(a, d)} → ${fmt(b, d)}`);
          const action =
            entry.audio.action === 'reencoded'
              ? `перекодирован: ${e.vbr}${e.mono ? ', stereo → mono' : ''}${e.trimmedLeadingMs ? `, −${fmt(e.trimmedLeadingMs, 0)} мс в начале` : ''}${e.trimmedTrailingMs ? `, −${fmt(e.trimmedTrailingMs, 0)} мс в конце` : ''}; SNR ${fmt(entry.audio.checks.snrDb, 1)} dB`
              : `скопирован без изменений: ${entry.audio.reason}`;
          return [
            code(entry.file.slice(manifest.outputDir.length + 1)),
            arrow(o.durationMs, p.durationMs),
            arrow(o.bitrateKbps, p.bitrateKbps),
            arrow(o.channels, p.channels),
            arrow(o.sampleRate, p.sampleRate),
            `${fmt(o.peakDb, 1)} / ${fmt(o.truePeakDb, 1)}`,
            `${fmt(o.rmsDb, 1)} / ${o.integratedLufs == null ? '—' : fmt(o.integratedLufs, 1)}`,
            o.overs > 0 || o.maxRunNearFullScale >= 3
              ? `**да** (${o.overs} сэмплов ≥ 0 dBFS)`
              : 'нет',
            `${fmt(o.leadingSilenceMs, 0)} / ${fmt(o.trailingSilenceMs, 0)}`,
            action,
            `${formatBytes(entry.original.size)} → ${formatBytes(entry.size)} (−${entry.reductionPercent}%)`,
            entry.flags.length ? entry.flags.join(' + ') : entry.status,
          ];
        }),
        [null, 'r', 'r', 'r', 'r', 'r', 'r', null, 'r', null, 'r', null],
      ),
    );
  }

  // SVG
  const svgs = items.filter(({ entry }) => entry.kind === 'svg');
  if (svgs.length) {
    L.push(`## SVG (${svgs.length})`, '');
    L.push(
      'SVGO preset-default (multipass): удалены комментарии, `<title>`/`<desc>` (react-native-svg их игнорирует), оптимизированы path и числа. viewBox и размеры сохранены, растеризации нет. Каждый результат проверен сравнением рендера до/после.',
      '',
    );
    L.push(
      ...table(
        ['Icon', 'viewBox', 'Было', 'Стало', 'Уменьшение', 'Действие', 'SSIM рендера', 'Status'],
        svgs.map(({ entry }) => [
          code(entry.file.slice(manifest.outputDir.length + 1)),
          code(entry.svg.viewBox ?? '—'),
          formatBytes(entry.original.size),
          formatBytes(entry.size),
          `${entry.reductionPercent}%`,
          entry.svg.reason,
          entry.svg.quality ? fmt(entry.svg.quality.ssim, 5) : '—',
          entry.flags.length ? entry.flags.join(' + ') : entry.status,
        ]),
        [null, null, 'r', 'r', 'r', null, 'r', null],
      ),
    );
  }

  // Duplicates
  L.push('## Дубликаты', '');
  if (manifest.excluded.length) {
    L.push('Точные бинарные дубликаты исключены из production (оригиналы сохранены):', '');
    for (const x of manifest.excluded) L.push(`- ${code(x.source)} = ${code(x.duplicateOf)}`);
  } else {
    L.push('- Точных бинарных дубликатов (SHA-256) нет.');
  }
  const dupes = items.filter(({ entry }) => entry.flags.includes(STATUS.DUPLICATE));
  L.push(
    dupes.length
      ? `- Визуальные/контентные дубликаты: ${dupes.length}, см. «${STATUS.DUPLICATE}» выше.`
      : '- Пиксельно идентичных изображений, визуально похожих (dHash) изображений и одинакового аудио под разными именами нет.',
    '',
  );

  // Validation
  L.push('## Валидация', '');
  L.push(
    ...table(
      ['Проверка', 'OK', 'Ошибок'],
      Object.entries(v.checks).map(([name, c]) => [CHECK_LABEL[name] ?? name, c.passed, c.failed]),
      [null, 'r', 'r'],
    ),
  );
  if (v.errors.length) {
    L.push('Ошибки:', '');
    for (const e of v.errors) L.push(`- ${e}`);
    L.push('');
  }
  if (v.warnings.length) {
    L.push('Предупреждения:', '');
    for (const w of v.warnings) L.push(`- ${w}`);
    L.push('');
  }

  // How to rerun
  L.push('## Как перезапустить', '');
  L.push(
    '```bash',
    'npm run assets:optimize                # пересобрать assets/ из assets-original/ (кэш по SHA-256 + настройкам)',
    'npm run assets:optimize -- --no-cache  # перекодировать всё с нуля',
    'npm run assets:check                   # только проверить assets/ и manifest, без записи',
    '```',
    '',
    'Чтобы заменить ассет: положите новый оригинал в `assets-original/` (то же имя) и запустите `npm run assets:optimize`. Повторный запуск всегда кодирует из оригиналов, поэтому качество не деградирует.',
    '',
  );

  // Settings
  const s = manifest.settings;
  L.push('## Настройки и инструменты', '');
  L.push(
    ...table(
      ['Инструмент', 'Версия'],
      Object.entries(manifest.tools).map(([k, val]) => [k, val]),
    ),
  );
  L.push(
    `- Гейт качества растровых изображений: SSIM ≥ ${s.image.gate.ssim}, SSIM p1 ≥ ${s.image.gate.ssimP1}, chroma SSIM ≥ ${s.image.gate.ssimChroma}, ошибка alpha ≤ ${s.image.gate.alphaMaxError} (худший из композитов на #FFFFFF и #151716).`,
    `- WebP: лестница качества ${s.image.webp.ladder.join(', ')} (старт ${s.image.webp.start}), alphaQuality ${s.image.webp.alphaQuality}, effort ${s.image.webp.effort}, sharp YUV ${s.image.webp.smartSubsample ? 'вкл.' : 'выкл.'}; WebP выбирается, если он меньше лучшего PNG минимум на ${s.image.formatPolicy.minRelativeSavings * 100}% и ${formatBytes(s.image.formatPolicy.minAbsoluteSavingsBytes)}.`,
    `- Профили разрешения: ${Object.entries(s.image.profiles)
      .map(([k, p]) => `${k} = ${p.maxWidth ? `≤${p.maxWidth}×${p.maxHeight}` : 'исходный размер'}`)
      .join('; ')}.`,
    `- SVG: гейт рендера SSIM ≥ ${s.svg.gate.ssim}, ошибка alpha ≤ ${s.svg.gate.alphaMaxError}.`,
    `- Аудио: MP3 LAME V${s.audio.mp3.vbrQuality}, перекодирование только при экономии ≥ ${s.audio.minRelativeSavings * 100}% и прохождении проверок (длительность ±${s.audio.tolerance.durationMs} мс, RMS ±${s.audio.tolerance.rmsDb} dB, пик ±${s.audio.tolerance.peakDb} dB, без нового клиппинга).`,
    '',
  );
  return `${L.join('\n').trimEnd()}\n`;
}
