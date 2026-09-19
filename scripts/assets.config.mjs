// Asset pipeline configuration. Every human decision lives here; the pipeline
// itself (scripts/optimize-assets.mjs) contains no per-file special cases.
//
// Source of truth: `sourceDir` (originals, never modified by the pipeline).
// `outputDir` is regenerated from the originals on every run.

export default {
  app: 'Milo — 90 Day English Challenge',
  sourceDir: 'assets-original',
  outputDir: 'assets',
  stagingDir: '.assets-build',
  reports: {
    markdown: 'ASSET_MANIFEST.md',
    json: 'assets-manifest.json',
  },

  // Top-level source folder -> production category.
  // `key` is the key in assets-manifest.json, `dir` the folder inside outputDir.
  categories: {
    mascot: { key: 'mascots', dir: 'mascots' },
    journey: { key: 'journey', dir: 'journey' },
    chapters: { key: 'chapters', dir: 'chapters' },
    achievements: { key: 'badges', dir: 'badges' },
    icons: { key: 'quests', dir: 'quests' },
    empty: { key: 'emptyStates', dir: 'empty-states' },
    effects: { key: 'effects', dir: 'effects' },
    sounds: { key: 'sounds', dir: 'sounds' },
    'design-system': { key: 'other', dir: 'design-system' },
  },

  // Assets the app is known to need. A missing one is reported as MISSING.
  expected: [
    'icons/quest-vocabulary.svg',
    'icons/quest-review.svg',
    'icons/quest-grammar.svg',
    'icons/quest-reading.svg',
    'icons/quest-final-battle.svg',
    'icons/quest-weekly-exam.svg',
    'effects/stars.png',
    'effects/streak-fire.png',
    'effects/confetti.png',
    'effects/sparkles.png',
    'effects/perfect-rays.png',
    'achievements/badge-team-streak.png',
    'achievements/badge-perfect-quiz.png',
    'sounds/tap-soft.mp3',
    'sounds/quest-complete.mp3',
    'sounds/day-complete.mp3',
    'sounds/correct.mp3',
    'sounds/wrong.mp3',
    'sounds/streak-up.mp3',
    'sounds/achievement-unlock.mp3',
    'sounds/level-up.mp3',
    'sounds/perfect.mp3',
    'sounds/weekly-exam-start.mp3',
    'sounds/weekly-exam-pass.mp3',
    'sounds/final-battle.mp3',
    'sounds/summit-victory.mp3',
    'sounds/friend-joined.mp3',
    'sounds/streak-lost.mp3',
  ],

  image: {
    // Resolution boxes in px: fit inside, keep aspect ratio, never upscale.
    // Phones only (design-system: responsive.baseWidth 390). Largest iPhone is
    // 440pt wide -> 1320px @3x; content width with 20pt side padding is
    // 400pt -> 1200px @3x.
    profiles: {
      fullBleed: {
        maxWidth: null,
        maxHeight: null,
        reason: 'full-bleed illustration: native resolution kept (≥1320px = 440pt @3x)',
      },
      scene: {
        maxWidth: 1200,
        maxHeight: 1400,
        reason: 'content-width illustration: 400pt @3x',
      },
      character: {
        maxWidth: 768,
        maxHeight: 768,
        reason: 'Milo character / empty state: up to 256pt @3x',
      },
      badge: {
        maxWidth: 512,
        maxHeight: 512,
        reason: 'badge: up to 170pt @3x',
      },
      overlay: {
        maxWidth: 1024,
        maxHeight: 1024,
        reason: 'celebration overlay (soft glow/particles)',
      },
    },

    // Defaults per production category key.
    categoryDefaults: {
      mascots: { profile: 'character', expectAlpha: true },
      journey: { profile: 'scene', expectAlpha: true },
      chapters: { profile: 'fullBleed', expectAlpha: false },
      badges: { profile: 'badge', expectAlpha: true },
      emptyStates: { profile: 'character', expectAlpha: true },
      effects: { profile: 'overlay', expectAlpha: true },
    },

    // Per-source-file overrides (path relative to sourceDir).
    // Supported keys: profile, expectAlpha, format ('webp' | 'png').
    files: {
      'journey/journey-background.png': { profile: 'fullBleed', expectAlpha: false },
      'effects/streak-fire.png': { profile: 'character' },
      // Full desk/room scenes rather than character cutouts.
      'mascot/milo-achievement.png': { profile: 'scene' },
      'mascot/milo-champion.png': { profile: 'scene' },
      'mascot/milo-day-complete.png': { profile: 'scene' },
      'mascot/milo-deadline.png': { profile: 'scene' },
      'mascot/milo-exam.png': { profile: 'scene' },
      'mascot/milo-final-battle.png': { profile: 'scene' },
      'mascot/milo-missed.png': { profile: 'scene' },
      'mascot/milo-perfect.png': { profile: 'scene' },
      'mascot/milo-streak.png': { profile: 'scene' },
    },

    // Lossy WebP: the lowest ladder quality that passes the gate wins (search
    // starts at `start`). Alpha is always encoded losslessly (alphaQuality 100).
    webp: {
      ladder: [75, 80, 85, 90, 94, 97],
      start: 90,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
    },
    png: {
      pngquantSpeed: 1,
      oxipngLevel: 4,
    },

    // Quality gate for any lossy candidate, measured against the losslessly
    // resized original. Calibrated on this asset set: WebP q90 was visually
    // identical at 2x zoom and scored >= 0.9885 / >= 0.9649; q85 already showed
    // softened knit texture and faint blocking in smooth backgrounds.
    gate: {
      ssim: 0.988, // luma SSIM, worst of light (#FFFFFF) and dark (#151716) composite
      ssimP1: 0.96, // 1st percentile of 32px block SSIM (local damage: text, edges)
      ssimChroma: 0.93, // chroma SSIM (lenient: 4:2:0 subsampling is inherent to lossy WebP)
      alphaMaxError: 0, // alpha must be bit-exact
    },

    // Use WebP only when it is substantially smaller than the best PNG
    // candidate that also passes the gate.
    formatPolicy: {
      minRelativeSavings: 0.25,
      minAbsoluteSavingsBytes: 10 * 1024,
    },

    nearDuplicateMaxDistance: 12, // dHash (256 bit) hamming distance
  },

  svg: {
    renderSize: 384, // px, for the before/after render comparison
    removeTitleAndDesc: true, // react-native-svg ignores <title>/<desc>
    gate: { ssim: 0.999, alphaMaxError: 16 },
  },

  audio: {
    silenceThresholdDb: -60,
    trim: {
      leadingMinMs: 40, // only "obvious" silence is removed
      leadingPadMs: 5,
      fadeInMs: 3,
      trailingMinMs: 150,
      trailingPadMs: 60,
      fadeOutMs: 40, // applied entirely below the silence threshold
    },
    // Downmix to mono only when the stereo image is inaudible.
    mono: { minCorrelation: 0.999, maxSideToMidDb: -35 },
    mp3: { vbrQuality: 2 }, // LAME -V2
    minRelativeSavings: 0.2, // otherwise the original bytes are kept
    // Transcode tolerances (decoded output vs decoded, trimmed source)
    tolerance: { rmsDb: 0.3, peakDb: 0.5, durationMs: 5 },
    review: {
      quietPeakDb: -18,
      abruptEndDb: -40, // RMS of the last 10 ms above this with no tail = hard cut, may click
    },
    // Per-source-file overrides: { mode: 'copy' | 'reencode' }
    files: {},
  },

  // Sprite sheets cut into separate originals by `npm run assets:slice`
  // (scripts/slice-assets.mjs). Rects are in sheet pixels; `erase` clears a
  // caption that touches the art. Each flag's base sits on its bottom edge,
  // so a flag can be anchored bottom-centre on the map.
  slices: {
    'journey/journey-flag.png': {
      'journey/journey-flag-large.png': { left: 25, top: 29, width: 735, height: 945 },
      'journey/journey-flag-normal.png': { left: 753, top: 12, width: 252, height: 311 },
      'journey/journey-flag-checkpoint.png': {
        left: 998,
        top: 20,
        width: 250,
        height: 306,
        erase: [{ left: 1053, top: 323, width: 159, height: 3 }],
      },
      'journey/journey-flag-complete.png': {
        left: 1242,
        top: 20,
        width: 290,
        height: 306,
        erase: [{ left: 1323, top: 323, width: 143, height: 3 }],
      },
      'journey/journey-flag-locked.png': {
        left: 753,
        top: 383,
        width: 257,
        height: 323,
        erase: [{ left: 824, top: 702, width: 127, height: 4 }],
      },
      'journey/journey-flag-banner.png': { left: 1017, top: 375, width: 233, height: 320 },
      'journey/journey-flag-small.png': { left: 1303, top: 433, width: 206, height: 268 },
      'journey/journey-flag-string.png': {
        left: 831,
        top: 752,
        width: 586,
        height: 207,
        erase: [{ left: 1065, top: 951, width: 115, height: 8 }],
      },
    },
  },

  // Findings from manual visual/aural review. Automatic checks add their own
  // flags (alpha, clipping, loudness, duplicates, <text> in SVG, ...).
  review: {
    'mascot/milo-achievement.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Сцена в теме программиста: постеры «Same Developer — A Brighter Future», «Code / Build / Learn»; встроенная UI-карточка «milo Achievement Unlocked!»; фигурка GitHub Octocat и логотип Apple на ноутбуке (чужие товарные знаки).',
    },
    'mascot/milo-champion.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Сцена в теме программиста: «Same Developer — A Brighter Future», «Clean Code», «Problem Solving», кружка «Developer In Progress»; встроенная UI-карточка «milo Champion!»; фигурка GitHub Octocat.',
    },
    'mascot/milo-day-complete.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Сцена в теме программиста: редактор кода (function Developer(), App.tsx), цель «Full-stack developer», книги «Clean Code / System Design»; фигурка GitHub Octocat.',
    },
    'mascot/milo-deadline.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Содержимое не соответствует имени: карточка «Level Complete!» и кубок — это празднование, а не дедлайн (design-system: warning = «Looking at a clock»). Тема программиста («Same Developer», «Better Code»).',
    },
    'mascot/milo-exam.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Встроенная UI-карточка «milo Exam» с вопросом по JavaScript («create an array in JavaScript») — не про английский; книги JavaScript / Data Structures; фигурка GitHub Octocat.',
    },
    'mascot/milo-final-battle.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Не соответствует design-system (finalBattle = «Adventure pose with headband»): Milo сидит спиной на закате; указатели «Higher Skills / Bigger Goals», кружка «Same Developer»; логотип Apple на ноутбуке.',
    },
    'mascot/milo-missed.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Не соответствует design-system (missed = «Sitting near an extinguished campfire»): довольный Milo отдыхает за столом; постеры «Good Code Better Tomorrow», «Clean Architecture»; фигурка GitHub Octocat.',
    },
    'mascot/milo-perfect.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Не соответствует design-system (perfect = «Large celebration with flag»): Milo подмигивает за ноутбуком; постеры «Good Code Better Tomorrow», «Plan / Code / Test».',
    },
    'mascot/milo-streak.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Не соответствует design-system (streak = «Walking confidently on the journey»): Milo ночью за ноутбуком; «Same Developer — A Brighter Future», «Clean Code / System Design»; фигурка GitHub Octocat.',
    },
    'achievements/badge-team-streak.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Кроме Milo на бейдже ещё 4 персонажа: собака, пингвин в шапке Milo, заяц и серый кот — выбивается из единого визуального языка Milo.',
    },
    'journey/journey-flag.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Лист-референс из 8 вариантов флага с вшитыми подписями (Normal, Checkpoint, Complete, Locked, Banner, «Stnall» — опечатка, String). Сам лист в приложении не используется: он нарезан на journey-flag-{large,normal,checkpoint,complete,locked,banner,small,string} без подписей (slices выше, npm run assets:slice).',
    },
    'effects/stars.png': {
      flags: ['VISUAL_REVIEW_REQUIRED'],
      note: 'Прозрачность корректная. Но это лист из ~10 разных звёзд (с лицом, в лавровом венке, падающая, рейтинг из 5 звёзд, в свечении, мелкие) — не один эффект. Решить: нарезать или использовать как декор целиком.',
    },
    'sounds/tap-soft.mp3': {
      flags: ['AUDIO_REVIEW_REQUIRED'],
      note: 'Не похоже на «мягкий тап»: первые ~300 мс — перегруженный всплеск (RMS ≈ −3 dBFS), затем ~700 мс шума на ≈ −25 dBFS; длительность 1.0 с, самый громкий звук набора. Нужна замена.',
    },
  },
};
