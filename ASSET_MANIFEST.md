# Asset manifest — Milo — 90 Day English Challenge

> Сгенерировано командой `npm run assets:optimize` (`scripts/optimize-assets.mjs`). Не редактируйте вручную: решения правятся в `scripts/assets.config.mjs`, после чего пайплайн перезапускается.
> Оригиналы (source of truth, не изменяются): `assets-original/` → production: `assets/`. Машиночитаемая версия: `assets-manifest.json`.

## Итог

| Тип | Файлов | Оригиналы | Production | Сэкономлено | Уменьшение |
| --- | ---: | ---: | ---: | ---: | ---: |
| Растровые изображения | 53 | 103.53 MB | 11.35 MB | 92.18 MB | 89% |
| SVG | 5 | 9.7 KB | 7.0 KB | 2.7 KB | 28% |
| Звуки | 15 | 688.5 KB | 284.1 KB | 404.4 KB | 58.7% |
| Прочее (JSON) | 1 | 17.5 KB | 17.5 KB | 0 B | 0% |
| **Всего** | **74** | **104.23 MB** | **11.65 MB** | **92.58 MB** | **88.8%** |

```
TOTAL ORIGINAL SIZE     104.23 MB   (109289609 bytes)
TOTAL OPTIMIZED SIZE     11.65 MB   (12216482 bytes)
TOTAL SAVED              92.58 MB   (97073127 bytes)
TOTAL REDUCTION             88.8%
```

**Валидация:** ✅ пройдена — 533 проверок, ошибок: 0, предупреждений: 0 (подробности в разделе «Валидация»).

## Требует внимания

Ассетов с флагами: **16** из 74, отсутствует: **1**. Один ассет может иметь несколько флагов.

| Status | Ассетов |
| --- | ---: |
| `MISSING` | 1 |
| `VISUAL_REVIEW_REQUIRED` | 13 |
| `AUDIO_REVIEW_REQUIRED` | 2 |
| `NEEDS_ALPHA_REVIEW` | 10 |
| `READY` | 58 |

### MISSING (1)

- `assets/quests/quest-grammar.svg` — ожидается, но не найден (`assets-original/icons/quest-grammar.svg`).

### VISUAL_REVIEW_REQUIRED (13)

- `assets/badges/badge-team-streak.webp`
  - Кроме Milo на бейдже ещё 4 персонажа: собака, пингвин в шапке Milo, заяц и серый кот — выбивается из единого визуального языка Milo.
- `assets/effects/stars.webp`
  - Прозрачность корректная. Но это лист из ~10 разных звёзд (с лицом, в лавровом венке, падающая, рейтинг из 5 звёзд, в свечении, мелкие) — не один эффект. Решить: нарезать или использовать как декор целиком.
- `assets/journey/journey-flag.webp`
  - Это лист-референс из 8 вариантов флага с вшитыми подписями (Normal, Checkpoint, Complete, Locked, Banner, «Stnall» — опечатка, String). Как один ассет не используется: нужно нарезать на отдельные файлы без подписей.
- `assets/mascots/milo-achievement.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Сцена в теме программиста: постеры «Same Developer — A Brighter Future», «Code / Build / Learn»; встроенная UI-карточка «milo Achievement Unlocked!»; фигурка GitHub Octocat и логотип Apple на ноутбуке (чужие товарные знаки).
- `assets/mascots/milo-champion.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Сцена в теме программиста: «Same Developer — A Brighter Future», «Clean Code», «Problem Solving», кружка «Developer In Progress»; встроенная UI-карточка «milo Champion!»; фигурка GitHub Octocat.
- `assets/mascots/milo-day-complete.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Сцена в теме программиста: редактор кода (function Developer(), App.tsx), цель «Full-stack developer», книги «Clean Code / System Design»; фигурка GitHub Octocat.
- `assets/mascots/milo-deadline.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Содержимое не соответствует имени: карточка «Level Complete!» и кубок — это празднование, а не дедлайн (design-system: warning = «Looking at a clock»). Тема программиста («Same Developer», «Better Code»).
- `assets/mascots/milo-exam.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Встроенная UI-карточка «milo Exam» с вопросом по JavaScript («create an array in JavaScript») — не про английский; книги JavaScript / Data Structures; фигурка GitHub Octocat.
- `assets/mascots/milo-final-battle.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Не соответствует design-system (finalBattle = «Adventure pose with headband»): Milo сидит спиной на закате; указатели «Higher Skills / Bigger Goals», кружка «Same Developer»; логотип Apple на ноутбуке.
- `assets/mascots/milo-missed.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Не соответствует design-system (missed = «Sitting near an extinguished campfire»): довольный Milo отдыхает за столом; постеры «Good Code Better Tomorrow», «Clean Architecture»; фигурка GitHub Octocat.
- `assets/mascots/milo-perfect.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Не соответствует design-system (perfect = «Large celebration with flag»): Milo подмигивает за ноутбуком; постеры «Good Code Better Tomorrow», «Plan / Code / Test».
- `assets/mascots/milo-streak.webp` _(также: NEEDS_ALPHA_REVIEW)_
  - Не соответствует design-system (streak = «Walking confidently on the journey»): Milo ночью за ноутбуком; «Same Developer — A Brighter Future», «Clean Code / System Design»; фигурка GitHub Octocat.
- `assets/quests/quest-vocabulary.svg`
  - Содержит <text> (font-family: Arial, Helvetica, sans-serif). react-native-svg рисует текст системным шрифтом: на Android нет Arial/Helvetica, надпись будет выглядеть иначе. Лучше перевести текст в кривые (outline) в редакторе.

### AUDIO_REVIEW_REQUIRED (2)

- `assets/sounds/streak-up.mp3`
  - Очень тихий: пик -22.89 dBFS, RMS -38.02 dBFS (медианный пик набора -1.95 dBFS). Громкость не менялась.
- `assets/sounds/tap-soft.mp3`
  - Клиппинг в исходнике: пик 3.41 dBFS, 2471 сэмплов ≥ 0 dBFS, до 5 сэмплов подряд у 0 dBFS. Не перекодировался — скопирован байт-в-байт.
  - Не похоже на «мягкий тап»: первые ~300 мс — перегруженный всплеск (RMS ≈ −3 dBFS), затем ~700 мс шума на ≈ −25 dBFS; длительность 1.0 с, самый громкий звук набора. Нужна замена.

### NEEDS_ALPHA_REVIEW (10)

- `assets/journey/journey-summit.webp`
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 65.8/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-achievement.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 107.6/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-champion.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 105.1/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-day-complete.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 103.7/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-deadline.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 97.9/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-exam.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 163.3/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-final-battle.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 92.9/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-missed.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 150.3/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-perfect.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 85.4/255). Alpha сохранена бит-в-бит.
- `assets/mascots/milo-streak.webp` _(также: VISUAL_REVIEW_REQUIRED)_
  - Полная сцена, а не вырезка: нет ни одного полностью прозрачного пикселя, края растушёваны полупрозрачностью (средняя alpha по краю 120.8/255). Alpha сохранена бит-в-бит.

### Заметки без статуса (низкий приоритет)

- `assets/sounds/final-battle.mp3` — Резкий обрыв в конце: последние 10 мс звучат на -27.47 dBFS без затухания — возможен щелчок. Не исправлялось.
- `assets/sounds/tap-soft.mp3` — Резкий обрыв в конце: последние 10 мс звучат на -26.32 dBFS без затухания — возможен щелчок. Не исправлялось.
- `assets/sounds/weekly-exam-start.mp3` — Резкий обрыв в конце: последние 10 мс звучат на -35.25 dBFS без затухания — возможен щелчок. Не исправлялось.

## Все ассеты

| Asset | Category | Original format | Production format | Original dimensions | Production dimensions | Original size | Production size | Reduction % | Transparency | Status |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `badges/badge-100-words.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.84 MB | 70.1 KB | 96.3% | alpha · вырезка | READY |
| `badges/badge-14-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.88 MB | 77.7 KB | 96% | alpha · вырезка | READY |
| `badges/badge-3-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.80 MB | 67.3 KB | 96.4% | alpha · вырезка | READY |
| `badges/badge-30-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.88 MB | 68.1 KB | 96.5% | alpha · вырезка | READY |
| `badges/badge-50-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.84 MB | 76.8 KB | 95.9% | alpha · вырезка | READY |
| `badges/badge-500-words.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.90 MB | 85.1 KB | 95.6% | alpha · вырезка | READY |
| `badges/badge-7-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.78 MB | 68.8 KB | 96.2% | alpha · вырезка | READY |
| `badges/badge-90-days.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.93 MB | 86.5 KB | 95.6% | alpha · вырезка | READY |
| `badges/badge-first-day.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.94 MB | 68.8 KB | 96.5% | alpha · вырезка | READY |
| `badges/badge-perfect-quiz.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.86 MB | 69.6 KB | 96.4% | alpha · вырезка | READY |
| `badges/badge-perfect-week.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.79 MB | 70.2 KB | 96.2% | alpha · вырезка | READY |
| `badges/badge-team-streak.webp` | badges | PNG | WebP | 1254×1254 | 512×512 | 1.85 MB | 71.5 KB | 96.2% | alpha · вырезка | VISUAL_REVIEW_REQUIRED |
| `chapters/chapter-01-beginning.webp` | chapters | PNG | WebP | 1536×1024 | 1536×1024 | 2.26 MB | 297.9 KB | 87.1% | нет (непрозрачное) | READY |
| `chapters/chapter-02-momentum.webp` | chapters | PNG | WebP | 1536×1024 | 1536×1024 | 2.50 MB | 367.8 KB | 85.6% | нет (непрозрачное) | READY |
| `chapters/chapter-03-habit.webp` | chapters | PNG | WebP | 1536×1024 | 1536×1024 | 2.44 MB | 271.8 KB | 89.1% | нет (непрозрачное) | READY |
| `chapters/chapter-04-growth.webp` | chapters | PNG | WebP | 1536×1024 | 1536×1024 | 2.42 MB | 269.6 KB | 89.1% | нет (непрозрачное) | READY |
| `chapters/chapter-05-summit.webp` | chapters | PNG | WebP | 1536×1024 | 1536×1024 | 2.19 MB | 276.8 KB | 87.7% | нет (непрозрачное) | READY |
| `design-system/design-system.json` | other | JSON | JSON | — | — | 17.5 KB | 17.5 KB | 0% | — | READY |
| `effects/confetti.webp` | effects | PNG | WebP | 1374×1145 | 1024×853 | 1.68 MB | 410.0 KB | 76.2% | alpha · мягкое свечение | READY |
| `effects/perfect-rays.webp` | effects | PNG | WebP | 1374×1145 | 1024×853 | 1.55 MB | 252.3 KB | 84.1% | alpha · мягкое свечение | READY |
| `effects/sparkles.webp` | effects | PNG | WebP | 1374×1145 | 1024×853 | 1.26 MB | 253.1 KB | 80.4% | alpha · мягкое свечение | READY |
| `effects/stars.webp` | effects | PNG | WebP | 1536×1024 | 1024×683 | 1.87 MB | 201.0 KB | 89.5% | alpha · вырезка | VISUAL_REVIEW_REQUIRED |
| `effects/streak-fire.webp` | effects | PNG | WebP | 1374×1145 | 768×640 | 899.5 KB | 59.3 KB | 93.4% | alpha · вырезка | READY |
| `empty-states/no-friends-yet.webp` | emptyStates | PNG | WebP | 1374×1145 | 768×640 | 1.51 MB | 114.3 KB | 92.6% | alpha · вырезка | READY |
| `empty-states/no-internet.webp` | emptyStates | PNG | WebP | 1374×1145 | 768×640 | 1.38 MB | 109.2 KB | 92.2% | alpha · вырезка | READY |
| `empty-states/nothing-to-review.webp` | emptyStates | PNG | WebP | 1374×1145 | 768×640 | 1.41 MB | 120.7 KB | 91.7% | alpha · вырезка | READY |
| `journey/journey-background.webp` | journey | PNG | WebP | 1672×941 | 1672×941 | 2.42 MB | 363.7 KB | 85.3% | нет (непрозрачное) | READY |
| `journey/journey-camp.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.42 MB | 289.6 KB | 88.3% | alpha · вырезка | READY |
| `journey/journey-campfire-off.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.64 MB | 374.5 KB | 86.1% | alpha · вырезка | READY |
| `journey/journey-campfire.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.56 MB | 388.8 KB | 85.2% | alpha · вырезка | READY |
| `journey/journey-flag.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.17 MB | 281.0 KB | 87.4% | alpha · вырезка | VISUAL_REVIEW_REQUIRED |
| `journey/journey-forest.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.95 MB | 431.1 KB | 85.7% | alpha · вырезка | READY |
| `journey/journey-mountains.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.91 MB | 379.0 KB | 87.3% | alpha · вырезка | READY |
| `journey/journey-path.webp` | journey | PNG | WebP | 1156×1360 | 1156×1360 | 1.41 MB | 356.0 KB | 75.3% | alpha · вырезка | READY |
| `journey/journey-river.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.70 MB | 326.6 KB | 88.2% | alpha · вырезка | READY |
| `journey/journey-summit.webp` | journey | PNG | WebP | 1536×1024 | 1200×800 | 2.68 MB | 415.9 KB | 84.9% | alpha · растушёванная сцена | NEEDS_ALPHA_REVIEW |
| `mascots/milo-achievement.webp` | mascots | PNG | WebP | 1672×941 | 1200×675 | 2.45 MB | 275.4 KB | 89% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-champion.webp` | mascots | PNG | WebP | 1672×941 | 1200×675 | 2.47 MB | 292.7 KB | 88.4% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-correct.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.33 MB | 119.1 KB | 91.3% | alpha · вырезка | READY |
| `mascots/milo-day-complete.webp` | mascots | PNG | WebP | 1312×1199 | 1200×1097 | 2.30 MB | 356.0 KB | 84.9% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-deadline.webp` | mascots | PNG | WebP | 1312×1199 | 1200×1097 | 2.31 MB | 379.0 KB | 84% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-exam.webp` | mascots | PNG | WebP | 1672×941 | 1200×675 | 2.39 MB | 263.3 KB | 89.2% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-final-battle.webp` | mascots | PNG | WebP | 1312×1199 | 1200×1097 | 2.55 MB | 459.9 KB | 82.4% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-grammar.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.38 MB | 101.2 KB | 92.8% | alpha · вырезка | READY |
| `mascots/milo-idle.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 883.8 KB | 61.7 KB | 93% | alpha · вырезка | READY |
| `mascots/milo-learning.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.30 MB | 109.8 KB | 91.8% | alpha · вырезка | READY |
| `mascots/milo-missed.webp` | mascots | PNG | WebP | 1672×941 | 1200×675 | 2.49 MB | 297.6 KB | 88.3% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-perfect.webp` | mascots | PNG | WebP | 1312×1199 | 1200×1097 | 2.27 MB | 465.5 KB | 80% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-reading.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.41 MB | 104.5 KB | 92.8% | alpha · вырезка | READY |
| `mascots/milo-streak.webp` | mascots | PNG | WebP | 1254×1254 | 1200×1200 | 2.49 MB | 450.6 KB | 82.3% | alpha · растушёванная сцена | VISUAL_REVIEW_REQUIRED + NEEDS_ALPHA_REVIEW |
| `mascots/milo-thinking.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.38 MB | 111.6 KB | 92.1% | alpha · вырезка | READY |
| `mascots/milo-vocabulary.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.21 MB | 90.6 KB | 92.7% | alpha · вырезка | READY |
| `mascots/milo-walking.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 873.4 KB | 63.4 KB | 92.7% | alpha · вырезка | READY |
| `mascots/milo-wrong.webp` | mascots | PNG | WebP | 1312×1199 | 768×702 | 1.60 MB | 129.1 KB | 92.1% | alpha · вырезка | READY |
| `quests/quest-final-battle.svg` | quests | SVG | SVG | 96×96 | 96×96 | 2.3 KB | 1.8 KB | 23.2% | вектор · прозрачный фон | READY |
| `quests/quest-reading.svg` | quests | SVG | SVG | 96×96 | 96×96 | 2.0 KB | 1.3 KB | 34.3% | вектор · прозрачный фон | READY |
| `quests/quest-review.svg` | quests | SVG | SVG | 96×96 | 96×96 | 1.4 KB | 1.1 KB | 25.1% | вектор · прозрачный фон | READY |
| `quests/quest-vocabulary.svg` | quests | SVG | SVG | 96×96 | 96×96 | 1.9 KB | 1.3 KB | 33.1% | вектор · прозрачный фон | VISUAL_REVIEW_REQUIRED |
| `quests/quest-weekly-exam.svg` | quests | SVG | SVG | 96×96 | 96×96 | 2.1 KB | 1.6 KB | 24.6% | вектор · прозрачный фон | READY |
| `sounds/achievement-unlock.mp3` | sounds | MP3 | MP3 | — | — | 46.0 KB | 12.4 KB | 73% | — | READY |
| `sounds/correct.mp3` | sounds | MP3 | MP3 | — | — | 20.5 KB | 2.4 KB | 88.3% | — | READY |
| `sounds/day-complete.mp3` | sounds | MP3 | MP3 | — | — | 53.1 KB | 17.9 KB | 66.3% | — | READY |
| `sounds/final-battle.mp3` | sounds | MP3 | MP3 | — | — | 71.5 KB | 36.9 KB | 48.4% | — | READY |
| `sounds/friend-joined.mp3` | sounds | MP3 | MP3 | — | — | 34.7 KB | 12.6 KB | 63.8% | — | READY |
| `sounds/level-up.mp3` | sounds | MP3 | MP3 | — | — | 57.2 KB | 27.4 KB | 52% | — | READY |
| `sounds/perfect.mp3` | sounds | MP3 | MP3 | — | — | 50.0 KB | 18.0 KB | 64% | — | READY |
| `sounds/quest-complete.mp3` | sounds | MP3 | MP3 | — | — | 34.7 KB | 3.9 KB | 88.7% | — | READY |
| `sounds/streak-lost.mp3` | sounds | MP3 | MP3 | — | — | 38.8 KB | 10.8 KB | 72.2% | — | READY |
| `sounds/streak-up.mp3` | sounds | MP3 | MP3 | — | — | 31.7 KB | 9.0 KB | 71.6% | — | AUDIO_REVIEW_REQUIRED |
| `sounds/summit-victory.mp3` | sounds | MP3 | MP3 | — | — | 100.0 KB | 51.8 KB | 48.2% | — | READY |
| `sounds/tap-soft.mp3` | sounds | MP3 | MP3 | — | — | 37.9 KB | 37.9 KB | 0% | — | AUDIO_REVIEW_REQUIRED |
| `sounds/weekly-exam-pass.mp3` | sounds | MP3 | MP3 | — | — | 53.1 KB | 26.0 KB | 51% | — | READY |
| `sounds/weekly-exam-start.mp3` | sounds | MP3 | MP3 | — | — | 34.7 KB | 10.0 KB | 71.3% | — | READY |
| `sounds/wrong.mp3` | sounds | MP3 | MP3 | — | — | 24.5 KB | 7.1 KB | 71.2% | — | READY |

## Переименования и перемещения (OLD → NEW)

Изменено имя файла (приведение к kebab-case):

| OLD | NEW |
| --- | --- |
| `assets-original/empty/no_friends_yet.png` | `assets/empty-states/no-friends-yet.webp` |
| `assets-original/empty/nothing_to_review.png` | `assets/empty-states/nothing-to-review.webp` |

Переименованные папки:

| OLD | NEW |
| --- | --- |
| `assets-original/achievements/` | `assets/badges/` |
| `assets-original/empty/` | `assets/empty-states/` |
| `assets-original/mascot/` | `assets/mascots/` |
| `assets-original/icons/` | `assets/quests/` |

<details><summary>Полный mapping всех путей</summary>

| OLD | NEW |
| --- | --- |
| `assets-original/achievements/badge-100-words.png` | `assets/badges/badge-100-words.webp` |
| `assets-original/achievements/badge-14-days.png` | `assets/badges/badge-14-days.webp` |
| `assets-original/achievements/badge-3-days.png` | `assets/badges/badge-3-days.webp` |
| `assets-original/achievements/badge-30-days.png` | `assets/badges/badge-30-days.webp` |
| `assets-original/achievements/badge-50-days.png` | `assets/badges/badge-50-days.webp` |
| `assets-original/achievements/badge-500-words.png` | `assets/badges/badge-500-words.webp` |
| `assets-original/achievements/badge-7-days.png` | `assets/badges/badge-7-days.webp` |
| `assets-original/achievements/badge-90-days.png` | `assets/badges/badge-90-days.webp` |
| `assets-original/achievements/badge-first-day.png` | `assets/badges/badge-first-day.webp` |
| `assets-original/achievements/badge-perfect-quiz.png` | `assets/badges/badge-perfect-quiz.webp` |
| `assets-original/achievements/badge-perfect-week.png` | `assets/badges/badge-perfect-week.webp` |
| `assets-original/achievements/badge-team-streak.png` | `assets/badges/badge-team-streak.webp` |
| `assets-original/chapters/chapter-01-beginning.png` | `assets/chapters/chapter-01-beginning.webp` |
| `assets-original/chapters/chapter-02-momentum.png` | `assets/chapters/chapter-02-momentum.webp` |
| `assets-original/chapters/chapter-03-habit.png` | `assets/chapters/chapter-03-habit.webp` |
| `assets-original/chapters/chapter-04-growth.png` | `assets/chapters/chapter-04-growth.webp` |
| `assets-original/chapters/chapter-05-summit.png` | `assets/chapters/chapter-05-summit.webp` |
| `assets-original/effects/confetti.png` | `assets/effects/confetti.webp` |
| `assets-original/effects/perfect-rays.png` | `assets/effects/perfect-rays.webp` |
| `assets-original/effects/sparkles.png` | `assets/effects/sparkles.webp` |
| `assets-original/effects/stars.png` | `assets/effects/stars.webp` |
| `assets-original/effects/streak-fire.png` | `assets/effects/streak-fire.webp` |
| `assets-original/empty/no_friends_yet.png` | `assets/empty-states/no-friends-yet.webp` |
| `assets-original/empty/no-internet.png` | `assets/empty-states/no-internet.webp` |
| `assets-original/empty/nothing_to_review.png` | `assets/empty-states/nothing-to-review.webp` |
| `assets-original/journey/journey-background.png` | `assets/journey/journey-background.webp` |
| `assets-original/journey/journey-camp.png` | `assets/journey/journey-camp.webp` |
| `assets-original/journey/journey-campfire-off.png` | `assets/journey/journey-campfire-off.webp` |
| `assets-original/journey/journey-campfire.png` | `assets/journey/journey-campfire.webp` |
| `assets-original/journey/journey-flag.png` | `assets/journey/journey-flag.webp` |
| `assets-original/journey/journey-forest.png` | `assets/journey/journey-forest.webp` |
| `assets-original/journey/journey-mountains.png` | `assets/journey/journey-mountains.webp` |
| `assets-original/journey/journey-path.png` | `assets/journey/journey-path.webp` |
| `assets-original/journey/journey-river.png` | `assets/journey/journey-river.webp` |
| `assets-original/journey/journey-summit.png` | `assets/journey/journey-summit.webp` |
| `assets-original/mascot/milo-achievement.png` | `assets/mascots/milo-achievement.webp` |
| `assets-original/mascot/milo-champion.png` | `assets/mascots/milo-champion.webp` |
| `assets-original/mascot/milo-correct.png` | `assets/mascots/milo-correct.webp` |
| `assets-original/mascot/milo-day-complete.png` | `assets/mascots/milo-day-complete.webp` |
| `assets-original/mascot/milo-deadline.png` | `assets/mascots/milo-deadline.webp` |
| `assets-original/mascot/milo-exam.png` | `assets/mascots/milo-exam.webp` |
| `assets-original/mascot/milo-final-battle.png` | `assets/mascots/milo-final-battle.webp` |
| `assets-original/mascot/milo-grammar.png` | `assets/mascots/milo-grammar.webp` |
| `assets-original/mascot/milo-idle.png` | `assets/mascots/milo-idle.webp` |
| `assets-original/mascot/milo-learning.png` | `assets/mascots/milo-learning.webp` |
| `assets-original/mascot/milo-missed.png` | `assets/mascots/milo-missed.webp` |
| `assets-original/mascot/milo-perfect.png` | `assets/mascots/milo-perfect.webp` |
| `assets-original/mascot/milo-reading.png` | `assets/mascots/milo-reading.webp` |
| `assets-original/mascot/milo-streak.png` | `assets/mascots/milo-streak.webp` |
| `assets-original/mascot/milo-thinking.png` | `assets/mascots/milo-thinking.webp` |
| `assets-original/mascot/milo-vocabulary.png` | `assets/mascots/milo-vocabulary.webp` |
| `assets-original/mascot/milo-walking.png` | `assets/mascots/milo-walking.webp` |
| `assets-original/mascot/milo-wrong.png` | `assets/mascots/milo-wrong.webp` |
| `assets-original/icons/quest-final-battle.svg` | `assets/quests/quest-final-battle.svg` |
| `assets-original/icons/quest-reading.svg` | `assets/quests/quest-reading.svg` |
| `assets-original/icons/quest-review.svg` | `assets/quests/quest-review.svg` |
| `assets-original/icons/quest-vocabulary.svg` | `assets/quests/quest-vocabulary.svg` |
| `assets-original/icons/quest-weekly-exam.svg` | `assets/quests/quest-weekly-exam.svg` |

</details>

## Конвертация PNG → WebP (53)

Для каждого файла выбрано минимальное качество WebP, прошедшее гейт; PNG-альтернатива — лучший PNG, прошедший тот же гейт (palette PNG, если проходит, иначе lossless). Alpha кодируется без потерь.

| Asset | WebP quality | SSIM | SSIM p1 | Alpha | Лучший PNG | PNG | WebP | WebP меньше PNG на |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |
| `badges/badge-100-words.webp` | 85 | 0.9882 | 0.9608 | бит-в-бит | png lossless (oxipng) | 371.0 KB | 70.1 KB | 81.1% |
| `badges/badge-14-days.webp` | 90 | 0.9923 | 0.9825 | бит-в-бит | png lossless (oxipng) | 361.3 KB | 77.7 KB | 78.5% |
| `badges/badge-3-days.webp` | 90 | 0.9911 | 0.9800 | бит-в-бит | png lossless (oxipng) | 334.7 KB | 67.3 KB | 79.9% |
| `badges/badge-30-days.webp` | 85 | 0.9886 | 0.9673 | бит-в-бит | png lossless (oxipng) | 371.3 KB | 68.1 KB | 81.7% |
| `badges/badge-50-days.webp` | 90 | 0.9923 | 0.9814 | бит-в-бит | png lossless (oxipng) | 357.0 KB | 76.8 KB | 78.5% |
| `badges/badge-500-words.webp` | 90 | 0.9924 | 0.9794 | бит-в-бит | png lossless (oxipng) | 384.6 KB | 85.1 KB | 77.9% |
| `badges/badge-7-days.webp` | 90 | 0.9912 | 0.9772 | бит-в-бит | png lossless (oxipng) | 339.5 KB | 68.8 KB | 79.7% |
| `badges/badge-90-days.webp` | 90 | 0.9919 | 0.9738 | бит-в-бит | png lossless (oxipng) | 385.5 KB | 86.5 KB | 77.6% |
| `badges/badge-first-day.webp` | 90 | 0.9901 | 0.9788 | бит-в-бит | png lossless (oxipng) | 342.5 KB | 68.8 KB | 79.9% |
| `badges/badge-perfect-quiz.webp` | 85 | 0.9884 | 0.9653 | бит-в-бит | png lossless (oxipng) | 375.8 KB | 69.6 KB | 81.5% |
| `badges/badge-perfect-week.webp` | 85 | 0.9881 | 0.9684 | бит-в-бит | png lossless (oxipng) | 366.2 KB | 70.2 KB | 80.8% |
| `badges/badge-team-streak.webp` | 85 | 0.9887 | 0.9711 | бит-в-бит | png lossless (oxipng) | 379.2 KB | 71.5 KB | 81.2% |
| `chapters/chapter-01-beginning.webp` | 90 | 0.9909 | 0.9767 | — | png lossless (oxipng) | 2.09 MB | 297.9 KB | 86.1% |
| `chapters/chapter-02-momentum.webp` | 90 | 0.9918 | 0.9670 | — | png lossless (oxipng) | 2.36 MB | 367.8 KB | 84.8% |
| `chapters/chapter-03-habit.webp` | 85 | 0.9885 | 0.9657 | — | png lossless (oxipng) | 2.28 MB | 271.8 KB | 88.3% |
| `chapters/chapter-04-growth.webp` | 85 | 0.9883 | 0.9677 | — | png lossless (oxipng) | 2.26 MB | 269.6 KB | 88.3% |
| `chapters/chapter-05-summit.webp` | 90 | 0.9907 | 0.9733 | — | png lossless (oxipng) | 2.01 MB | 276.8 KB | 86.5% |
| `effects/confetti.webp` | 75 | 0.9922 | 0.9809 | бит-в-бит | png lossless (oxipng) | 1.05 MB | 410.0 KB | 61.8% |
| `effects/perfect-rays.webp` | 80 | 0.9887 | 0.9717 | бит-в-бит | png lossless (oxipng) | 960.6 KB | 252.3 KB | 73.7% |
| `effects/sparkles.webp` | 80 | 0.9916 | 0.9778 | бит-в-бит | png lossless (oxipng) | 793.9 KB | 253.1 KB | 68.1% |
| `effects/stars.webp` | 90 | 0.9901 | 0.9806 | бит-в-бит | png lossless (oxipng) | 594.2 KB | 201.0 KB | 66.2% |
| `effects/streak-fire.webp` | 94 | 0.9901 | 0.9751 | бит-в-бит | png lossless (oxipng) | 277.7 KB | 59.3 KB | 78.7% |
| `empty-states/no-friends-yet.webp` | 90 | 0.9886 | 0.9602 | бит-в-бит | png lossless (oxipng) | 502.4 KB | 114.3 KB | 77.3% |
| `empty-states/no-internet.webp` | 94 | 0.9925 | 0.9747 | бит-в-бит | png lossless (oxipng) | 454.1 KB | 109.2 KB | 76% |
| `empty-states/nothing-to-review.webp` | 94 | 0.9930 | 0.9754 | бит-в-бит | png lossless (oxipng) | 468.7 KB | 120.7 KB | 74.3% |
| `journey/journey-background.webp` | 90 | 0.9890 | 0.9769 | — | png lossless (oxipng) | 2.35 MB | 363.7 KB | 84.9% |
| `journey/journey-camp.webp` | 90 | 0.9893 | 0.9743 | бит-в-бит | png lossless (oxipng) | 1.23 MB | 289.6 KB | 77% |
| `journey/journey-campfire-off.webp` | 90 | 0.9925 | 0.9814 | бит-в-бит | png lossless (oxipng) | 1.49 MB | 374.5 KB | 75.4% |
| `journey/journey-campfire.webp` | 90 | 0.9901 | 0.9729 | бит-в-бит | png lossless (oxipng) | 1.42 MB | 388.8 KB | 73.3% |
| `journey/journey-flag.webp` | 94 | 0.9883 | 0.9650 | бит-в-бит | png lossless (oxipng) | 873.3 KB | 281.0 KB | 67.8% |
| `journey/journey-forest.webp` | 90 | 0.9919 | 0.9815 | бит-в-бит | png lossless (oxipng) | 1.66 MB | 431.1 KB | 74.6% |
| `journey/journey-mountains.webp` | 85 | 0.9893 | 0.9759 | бит-в-бит | png lossless (oxipng) | 1.68 MB | 379.0 KB | 78% |
| `journey/journey-path.webp` | 90 | 0.9890 | 0.9734 | бит-в-бит | png lossless (oxipng) | 1.35 MB | 356.0 KB | 74.3% |
| `journey/journey-river.webp` | 85 | 0.9884 | 0.9725 | бит-в-бит | png lossless (oxipng) | 1.45 MB | 326.6 KB | 78% |
| `journey/journey-summit.webp` | 90 | 0.9910 | 0.9774 | бит-в-бит | png lossless (oxipng) | 1.75 MB | 415.9 KB | 76.8% |
| `mascots/milo-achievement.webp` | 90 | 0.9912 | 0.9696 | бит-в-бит | png lossless (oxipng) | 1.31 MB | 275.4 KB | 79.4% |
| `mascots/milo-champion.webp` | 90 | 0.9917 | 0.9702 | бит-в-бит | png lossless (oxipng) | 1.33 MB | 292.7 KB | 78.4% |
| `mascots/milo-correct.webp` | 90 | 0.9895 | 0.9689 | бит-в-бит | png lossless (oxipng) | 495.1 KB | 119.1 KB | 75.9% |
| `mascots/milo-day-complete.webp` | 90 | 0.9904 | 0.9654 | бит-в-бит | png lossless (oxipng) | 1.88 MB | 356.0 KB | 81.5% |
| `mascots/milo-deadline.webp` | 90 | 0.9916 | 0.9629 | бит-в-бит | png lossless (oxipng) | 1.89 MB | 379.0 KB | 80.5% |
| `mascots/milo-exam.webp` | 90 | 0.9909 | 0.9706 | бит-в-бит | png lossless (oxipng) | 1.28 MB | 263.3 KB | 79.8% |
| `mascots/milo-final-battle.webp` | 90 | 0.9896 | 0.9660 | бит-в-бит | png lossless (oxipng) | 2.08 MB | 459.9 KB | 78.4% |
| `mascots/milo-grammar.webp` | 90 | 0.9896 | 0.9705 | бит-в-бит | png lossless (oxipng) | 506.8 KB | 101.2 KB | 80% |
| `mascots/milo-idle.webp` | 90 | 0.9885 | 0.9630 | бит-в-бит | png lossless (oxipng) | 305.7 KB | 61.7 KB | 79.8% |
| `mascots/milo-learning.webp` | 94 | 0.9925 | 0.9821 | бит-в-бит | png lossless (oxipng) | 468.5 KB | 109.8 KB | 76.6% |
| `mascots/milo-missed.webp` | 90 | 0.9908 | 0.9687 | бит-в-бит | png lossless (oxipng) | 1.33 MB | 297.6 KB | 78.1% |
| `mascots/milo-perfect.webp` | 94 | 0.9930 | 0.9711 | бит-в-бит | png lossless (oxipng) | 1.85 MB | 465.5 KB | 75.5% |
| `mascots/milo-reading.webp` | 90 | 0.9891 | 0.9660 | бит-в-бит | png lossless (oxipng) | 521.1 KB | 104.5 KB | 79.9% |
| `mascots/milo-streak.webp` | 90 | 0.9903 | 0.9683 | бит-в-бит | png lossless (oxipng) | 2.19 MB | 450.6 KB | 79.9% |
| `mascots/milo-thinking.webp` | 90 | 0.9893 | 0.9708 | бит-в-бит | png lossless (oxipng) | 505.5 KB | 111.6 KB | 77.9% |
| `mascots/milo-vocabulary.webp` | 90 | 0.9899 | 0.9722 | бит-в-бит | png lossless (oxipng) | 445.2 KB | 90.6 KB | 79.7% |
| `mascots/milo-walking.webp` | 94 | 0.9917 | 0.9806 | бит-в-бит | png lossless (oxipng) | 299.0 KB | 63.4 KB | 78.8% |
| `mascots/milo-wrong.webp` | 90 | 0.9900 | 0.9780 | бит-в-бит | png lossless (oxipng) | 593.4 KB | 129.1 KB | 78.2% |

## Изменение разрешения (46 из 53)

Размеры считаются для телефонов: самый широкий iPhone — 440pt (1320px @3x); ширина контента с отступами 20pt — 400pt (1200px @3x). «Чёткий до» — максимальный размер отображения без апскейла на экране @3x.

| Asset | Было | Стало | Профиль | Чёткий до (@3x) |
| --- | ---: | ---: | --- | ---: |
| `badges/badge-100-words.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-14-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-3-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-30-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-50-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-500-words.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-7-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-90-days.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-first-day.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-perfect-quiz.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-perfect-week.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `badges/badge-team-streak.webp` | 1254×1254 | **512×512** | badge — badge: up to 170pt @3x | 170×170 pt |
| `chapters/chapter-01-beginning.webp` | 1536×1024 | 1536×1024 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 512×341 pt |
| `chapters/chapter-02-momentum.webp` | 1536×1024 | 1536×1024 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 512×341 pt |
| `chapters/chapter-03-habit.webp` | 1536×1024 | 1536×1024 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 512×341 pt |
| `chapters/chapter-04-growth.webp` | 1536×1024 | 1536×1024 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 512×341 pt |
| `chapters/chapter-05-summit.webp` | 1536×1024 | 1536×1024 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 512×341 pt |
| `effects/confetti.webp` | 1374×1145 | **1024×853** | overlay — celebration overlay (soft glow/particles) | 341×284 pt |
| `effects/perfect-rays.webp` | 1374×1145 | **1024×853** | overlay — celebration overlay (soft glow/particles) | 341×284 pt |
| `effects/sparkles.webp` | 1374×1145 | **1024×853** | overlay — celebration overlay (soft glow/particles) | 341×284 pt |
| `effects/stars.webp` | 1536×1024 | **1024×683** | overlay — celebration overlay (soft glow/particles) | 341×227 pt |
| `effects/streak-fire.webp` | 1374×1145 | **768×640** | character — Milo character / empty state: up to 256pt @3x | 256×213 pt |
| `empty-states/no-friends-yet.webp` | 1374×1145 | **768×640** | character — Milo character / empty state: up to 256pt @3x | 256×213 pt |
| `empty-states/no-internet.webp` | 1374×1145 | **768×640** | character — Milo character / empty state: up to 256pt @3x | 256×213 pt |
| `empty-states/nothing-to-review.webp` | 1374×1145 | **768×640** | character — Milo character / empty state: up to 256pt @3x | 256×213 pt |
| `journey/journey-background.webp` | 1672×941 | 1672×941 (без изменений) | fullBleed — full-bleed illustration: native resolution kept (≥1320px = 440pt @3x) | 557×313 pt |
| `journey/journey-camp.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-campfire-off.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-campfire.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-flag.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-forest.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-mountains.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-path.webp` | 1156×1360 | 1156×1360 (без изменений) | scene — content-width illustration: 400pt @3x | 385×453 pt |
| `journey/journey-river.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `journey/journey-summit.webp` | 1536×1024 | **1200×800** | scene — content-width illustration: 400pt @3x | 400×266 pt |
| `mascots/milo-achievement.webp` | 1672×941 | **1200×675** | scene — content-width illustration: 400pt @3x | 400×225 pt |
| `mascots/milo-champion.webp` | 1672×941 | **1200×675** | scene — content-width illustration: 400pt @3x | 400×225 pt |
| `mascots/milo-correct.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-day-complete.webp` | 1312×1199 | **1200×1097** | scene — content-width illustration: 400pt @3x | 400×365 pt |
| `mascots/milo-deadline.webp` | 1312×1199 | **1200×1097** | scene — content-width illustration: 400pt @3x | 400×365 pt |
| `mascots/milo-exam.webp` | 1672×941 | **1200×675** | scene — content-width illustration: 400pt @3x | 400×225 pt |
| `mascots/milo-final-battle.webp` | 1312×1199 | **1200×1097** | scene — content-width illustration: 400pt @3x | 400×365 pt |
| `mascots/milo-grammar.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-idle.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-learning.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-missed.webp` | 1672×941 | **1200×675** | scene — content-width illustration: 400pt @3x | 400×225 pt |
| `mascots/milo-perfect.webp` | 1312×1199 | **1200×1097** | scene — content-width illustration: 400pt @3x | 400×365 pt |
| `mascots/milo-reading.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-streak.webp` | 1254×1254 | **1200×1200** | scene — content-width illustration: 400pt @3x | 400×400 pt |
| `mascots/milo-thinking.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-vocabulary.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-walking.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |
| `mascots/milo-wrong.webp` | 1312×1199 | **768×702** | character — Milo character / empty state: up to 256pt @3x | 256×234 pt |

## Звуки (15)

Громкость не нормализовалась. Тишина обрезается только очевидная (в начале ≥ 40 мс, в конце ≥ 150 мс ниже −60 dBFS), с сохранением короткого запаса; моно — только если стерео-разница неслышима (корреляция ≥ 0.999 и side ≤ −35 dB относительно mid).

| Sound | Длительность, мс | Битрейт, kbps | Каналы | Sample rate | Пик / true peak, dBFS | RMS, dBFS / LUFS | Клиппинг | Тишина начало / конец, мс | Действие | Размер | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: | --- |
| `sounds/achievement-unlock.mp3` | 1115 → 1063 | 320 → 96 | 2 → 1 | 44100 | -1.5 / -1.4 | -19.9 / -18.8 | нет | 57 / 141 | перекодирован: V2, stereo → mono, −52 мс в начале; SNR 31.4 dB | 46.0 KB → 12.4 KB (−73%) | READY |
| `sounds/correct.mp3` | 464 → 159 | 320 → 124 | 2 → 1 | 44100 | -1.5 / -1.5 | -25.9 / -21.9 | нет | 0 / 366 | перекодирован: V2, stereo → mono, −306 мс в конце; SNR 39.0 dB | 20.5 KB → 2.4 KB (−88.3%) | READY |
| `sounds/day-complete.mp3` | 1300 | 320 → 113 | 2 → 1 | 44100 | -1.2 / -1.1 | -18.5 / -14.5 | нет | 0 / 0 | перекодирован: V2, stereo → mono; SNR 29.6 dB | 53.1 KB → 17.9 KB (−66.3%) | READY |
| `sounds/final-battle.mp3` | 1765 | 320 → 171 | 2 | 44100 | -2.0 / -2.1 | -15.9 / -15.5 | нет | 0 / 0 | перекодирован: V2; SNR 36.7 dB | 71.5 KB → 36.9 KB (−48.4%) | READY |
| `sounds/friend-joined.mp3` | 836 → 703 | 320 → 147 | 2 | 44100 | -0.9 / -0.9 | -24.2 / -18.4 | нет | 0 / 193 | перекодирован: V2, −133 мс в конце; SNR 45.4 dB | 34.7 KB → 12.6 KB (−63.8%) | READY |
| `sounds/level-up.mp3` | 1393 | 320 → 161 | 2 | 44100 | -2.7 / -2.7 | -14.1 / -11.3 | нет | 0 / 1 | перекодирован: V2; SNR 36.4 dB | 57.2 KB → 27.4 KB (−52%) | READY |
| `sounds/perfect.mp3` | 1207 | 320 → 122 | 2 → 1 | 44100 | -6.9 / -6.0 | -22.7 / -15.5 | нет | 0 / 83 | перекодирован: V2, stereo → mono; SNR 22.0 dB | 50.0 KB → 18.0 KB (−64%) | READY |
| `sounds/quest-complete.mp3` | 836 → 350 | 320 → 92 | 2 → 1 | 44100 | -0.1 / -0.1 | -28.1 / -22.0 | нет | 186 / 366 | перекодирован: V2, stereo → mono, −181 мс в начале, −306 мс в конце; SNR 34.1 dB | 34.7 KB → 3.9 KB (−88.7%) | READY |
| `sounds/streak-lost.mp3` | 929 | 320 → 95 | 2 → 1 | 44100 | -3.7 / -3.7 | -17.1 / -17.3 | нет | 0 / 35 | перекодирован: V2, stereo → mono; SNR 41.4 dB | 38.8 KB → 10.8 KB (−72.2%) | READY |
| `sounds/streak-up.mp3` | 743 | 320 → 99 | 2 → 1 | 44100 | -22.9 / -22.9 | -38.0 / -37.0 | нет | 1 / 0 | перекодирован: V2, stereo → mono; SNR 31.5 dB | 31.7 KB → 9.0 KB (−71.6%) | AUDIO_REVIEW_REQUIRED |
| `sounds/summit-victory.mp3` | 2508 | 320 → 169 | 2 | 44100 | -3.1 / -3.1 | -13.0 / -13.5 | нет | 16 / 0 | перекодирован: V2; SNR 35.1 dB | 100.0 KB → 51.8 KB (−48.2%) | READY |
| `sounds/tap-soft.mp3` | 1000 | 192 | 2 | 44100 | 3.4 / 5.2 | -8.5 / -2.1 | **да** (2471 сэмплов ≥ 0 dBFS) | 0 / 0 | скопирован без изменений: source is clipped: kept byte-identical instead of transcoding damaged audio | 37.9 KB → 37.9 KB (−0%) | AUDIO_REVIEW_REQUIRED |
| `sounds/weekly-exam-pass.mp3` | 1300 | 320 → 164 | 2 | 44100 | -1.3 / -1.3 | -18.6 / -17.5 | нет | 0 / 84 | перекодирован: V2; SNR 39.2 dB | 53.1 KB → 26.0 KB (−51%) | READY |
| `sounds/weekly-exam-start.mp3` | 836 | 320 → 98 | 2 → 1 | 44100 | -1.9 / -1.9 | -13.5 / -13.4 | нет | 30 / 0 | перекодирован: V2, stereo → mono; SNR 39.4 dB | 34.7 KB → 10.0 KB (−71.3%) | READY |
| `sounds/wrong.mp3` | 557 | 320 → 104 | 2 → 1 | 44100 | -3.4 / -3.4 | -13.1 / -11.8 | нет | 0 / 10 | перекодирован: V2, stereo → mono; SNR 41.8 dB | 24.5 KB → 7.1 KB (−71.2%) | READY |

## SVG (5)

SVGO preset-default (multipass): удалены комментарии, `<title>`/`<desc>` (react-native-svg их игнорирует), оптимизированы path и числа. viewBox и размеры сохранены, растеризации нет. Каждый результат проверен сравнением рендера до/после.

| Icon | viewBox | Было | Стало | Уменьшение | Действие | SSIM рендера | Status |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| `quests/quest-final-battle.svg` | `0 0 96 96` | 2.3 KB | 1.8 KB | 23.2% | SVGO preset-default, multipass | 1.00000 | READY |
| `quests/quest-reading.svg` | `0 0 96 96` | 2.0 KB | 1.3 KB | 34.3% | SVGO preset-default, multipass | 0.99999 | READY |
| `quests/quest-review.svg` | `0 0 96 96` | 1.4 KB | 1.1 KB | 25.1% | SVGO preset-default, multipass | 1.00000 | READY |
| `quests/quest-vocabulary.svg` | `0 0 96 96` | 1.9 KB | 1.3 KB | 33.1% | SVGO preset-default, multipass | 1.00000 | VISUAL_REVIEW_REQUIRED |
| `quests/quest-weekly-exam.svg` | `0 0 96 96` | 2.1 KB | 1.6 KB | 24.6% | SVGO preset-default, multipass | 1.00000 | READY |

## Дубликаты

- Точных бинарных дубликатов (SHA-256) нет.
- Пиксельно идентичных изображений, визуально похожих (dHash) изображений и одинакового аудио под разными именами нет.

## Валидация

| Проверка | OK | Ошибок |
| --- | ---: | ---: |
| Каждый output-файл существует | 74 | 0 |
| Manifest соответствует файлам (размер, SHA-256, нет лишних) | 74 | 0 |
| Каждое изображение декодируется, формат верный | 53 | 0 |
| Размеры не нулевые и совпадают с manifest | 58 | 0 |
| Alpha сохранена там, где была (бит-в-бит) | 47 | 0 |
| Качество не ниже гейта (SSIM против оригинала / рендера) | 58 | 0 |
| SVG валидны (XML, viewBox, рендер) | 5 | 0 |
| Аудио читается ffprobe и декодируется без ошибок | 15 | 0 |
| JSON валиден и идентичен оригиналу | 1 | 0 |
| Имена в kebab-case, уникальны, расширение = формат | 74 | 0 |
| Каждый оригинал учтён | 74 | 0 |

## Как перезапустить

```bash
npm run assets:optimize                # пересобрать assets/ из assets-original/ (кэш по SHA-256 + настройкам)
npm run assets:optimize -- --no-cache  # перекодировать всё с нуля
npm run assets:check                   # только проверить assets/ и manifest, без записи
```

Чтобы заменить ассет: положите новый оригинал в `assets-original/` (то же имя) и запустите `npm run assets:optimize`. Повторный запуск всегда кодирует из оригиналов, поэтому качество не деградирует.

## Настройки и инструменты

| Инструмент | Версия |
| --- | --- |
| sharp | 0.35.4 |
| libvips | 8.18.6 |
| libwebp | 1.6.0 |
| pngquant | 3.0.3 |
| oxipng | 10.2.1 |
| svgo | 4.1.0 |
| ffmpeg | 8.1.2 |
| ffprobe | 8.1.2 |

- Гейт качества растровых изображений: SSIM ≥ 0.988, SSIM p1 ≥ 0.96, chroma SSIM ≥ 0.93, ошибка alpha ≤ 0 (худший из композитов на #FFFFFF и #151716).
- WebP: лестница качества 75, 80, 85, 90, 94, 97 (старт 90), alphaQuality 100, effort 6, sharp YUV вкл.; WebP выбирается, если он меньше лучшего PNG минимум на 25% и 10.0 KB.
- Профили разрешения: fullBleed = исходный размер; scene = ≤1200×1400; character = ≤768×768; badge = ≤512×512; overlay = ≤1024×1024.
- SVG: гейт рендера SSIM ≥ 0.999, ошибка alpha ≤ 16.
- Аудио: MP3 LAME V2, перекодирование только при экономии ≥ 20% и прохождении проверок (длительность ±5 мс, RMS ±0.3 dB, пик ±0.5 dB, без нового клиппинга).
