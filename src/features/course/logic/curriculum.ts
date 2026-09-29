import {
  BAND_LEVEL,
  CEFR_LEVELS,
  CURRICULUM_BANDS,
  GRAMMAR_STAGES,
  READING_GENRES,
  type CefrLevel,
  type Course,
  type CourseDay,
  type CurriculumBand,
  type DayNumber,
  type GrammarStage,
  type ReadingGenre,
} from '@/schemas';

import { indexCourse, introductionDays } from './course-index';
import { dayId, questId } from './ids';
import { formatIssue, type CourseIssue } from './validate';

/**
 * Rules about the learning design, next to `validateCourse`'s rules about the
 * playable content. Run by `npm run content:validate` and the tests — never at
 * app startup: a gap in the design must not stop anyone playing.
 *
 * Errors are objective breaks: a day without objectives, a topic before its
 * prerequisites, a checkpoint that does not cover its week, a level that goes
 * down. Warnings flag written content that has drifted from the plan (to
 * revise, not to block). Taste stays out of it.
 */

const levelRank = (level: CefrLevel) => CEFR_LEVELS.indexOf(level);
const bandRank = (band: CurriculumBand) => CURRICULUM_BANDS.indexOf(band);

/** "miss (a train)" → "miss": the hint in brackets is for the author, not the word. */
export const normalizeWord = (word: string) =>
  word
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()
    .toLowerCase();

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function validateCurriculum(course: Course): CourseIssue[] {
  const issues: CourseIssue[] = [];
  const error = (path: string, message: string) =>
    issues.push({ severity: 'error', path, message });
  const warning = (path: string, message: string) =>
    issues.push({ severity: 'warning', path, message });

  const { curriculum } = course;
  const index = indexCourse(course);
  const introduced = introductionDays(index);

  // ── The syllabus ────────────────────────────────────────────────────────────
  const topics = new Map<string, (typeof curriculum.grammarTopics)[number]>();
  for (const topic of curriculum.grammarTopics) {
    if (topics.has(topic.id))
      error(`curriculum.grammarTopics[${topic.id}]`, 'duplicate grammar topic');
    topics.set(topic.id, topic);
  }
  for (const topic of curriculum.grammarTopics) {
    for (const prerequisite of topic.prerequisites) {
      if (!topics.has(prerequisite))
        error(
          `curriculum.grammarTopics[${topic.id}].prerequisites`,
          `unknown topic "${prerequisite}"`,
        );
    }
  }
  const families = new Set<string>();
  for (const family of curriculum.themes) {
    if (families.has(family.id)) error(`curriculum.themes[${family.id}]`, 'duplicate theme family');
    families.add(family.id);
  }
  const profiles = new Map(curriculum.bands.map((profile) => [profile.band, profile]));
  for (const profile of curriculum.bands) {
    if (profile.level !== BAND_LEVEL[profile.band])
      error(
        `curriculum.bands[${profile.band}].level`,
        `band ${profile.band} sits in ${BAND_LEVEL[profile.band]}, not ${profile.level}`,
      );
  }

  // ── Chapters: the difficulty curve never goes down ─────────────────────────
  const chapters = [...course.chapters].sort((a, b) => a.number - b.number);
  const chapterOf = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  chapters.forEach((chapter, position) => {
    if (!profiles.has(chapter.band))
      error(`chapters[${chapter.id}].band`, `no band profile for ${chapter.band}`);
    const before = chapters[position - 1];
    if (before && bandRank(chapter.band) < bandRank(before.band))
      error(
        `chapters[${chapter.id}].band`,
        `${chapter.band} after ${before.band}: the difficulty curve never goes down`,
      );
  });

  // ── Days ────────────────────────────────────────────────────────────────────
  const kindOf = new Map(course.days.map((day) => [day.day, day.kind]));
  const hasMaterial = (day: DayNumber, before: DayNumber) => {
    const kind = kindOf.get(day);
    return day >= 1 && day < before && kind !== undefined && kind !== 'summit';
  };
  const checkpointDays = course.days
    .filter((day) => day.kind === 'weeklyExam')
    .map((day) => day.day);

  // Words written so far, by normalized word, with the day that teaches them.
  const writtenWords = new Map<string, DayNumber>();
  for (const definition of course.lessons) {
    if (definition.type !== 'vocabulary') continue;
    const day = index.slots.get(definition.questId)?.day;
    if (day === undefined) continue;
    for (const id of definition.wordIds) {
      const word = index.words.get(id);
      if (word) writtenWords.set(normalizeWord(word.word), day);
    }
  }

  const themeTitles = new Map<string, string>();
  const plannedWords = new Map<string, string>();
  let previousLesson: { day: CourseDay; family: string } | null = null;

  for (const day of course.days) {
    const plan = day.curriculum;
    const path = `${day.id}.curriculum`;
    if (!plan) {
      error(day.id, 'no curriculum: every day states what it teaches');
      continue;
    }
    if (plan.kind !== day.kind)
      error(`${path}.kind`, `the course plan makes ${day.id} ${day.kind}, not ${plan.kind}`);

    const chapter = chapterOf.get(day.chapterId);
    if (chapter && BAND_LEVEL[chapter.band] !== day.level)
      error(
        `${day.id}.level`,
        `${day.level} does not match its chapter's band ${chapter.band} (${BAND_LEVEL[chapter.band]})`,
      );
    const profile = chapter ? profiles.get(chapter.band) : undefined;

    // Themes: known families, one title per day, no family twice in a row.
    if (!families.has(plan.theme.family))
      error(`${path}.theme.family`, `unknown theme family "${plan.theme.family}"`);
    const titleTwin = themeTitles.get(plan.theme.title.toLowerCase());
    if (titleTwin)
      error(`${path}.theme.title`, `"${plan.theme.title}" is already the theme of ${titleTwin}`);
    themeTitles.set(plan.theme.title.toLowerCase(), day.id);
    if (plan.kind === 'regular') {
      if (previousLesson && previousLesson.family === plan.theme.family)
        error(
          `${path}.theme.family`,
          `"${plan.theme.family}" again right after ${previousLesson.day.id}: lesson days change theme`,
        );
      previousLesson = { day, family: plan.theme.family };
    }

    // Vocabulary anchors: planned once, never a word another day already teaches.
    if (plan.kind !== 'summit') {
      const written = [...writtenWords].filter(([, taughtOn]) => taughtOn === day.day);
      plan.vocabulary.examples.forEach((example, position) => {
        const word = normalizeWord(example);
        const examplePath = `${path}.vocabulary.examples[${position}]`;
        const twin = plannedWords.get(word);
        if (twin) error(examplePath, `"${example}" is already planned for ${twin}`);
        plannedWords.set(word, day.id);
        const taughtOn = writtenWords.get(word);
        if (taughtOn !== undefined && taughtOn !== day.day)
          error(examplePath, `"${example}" is already taught on ${dayId(taughtOn)}`);
        if (written.length > 0 && taughtOn !== day.day)
          warning(examplePath, `"${example}" is not among the words written for ${day.id}`);
      });
    }

    // The review mix and where it comes back from.
    if (plan.kind !== 'summit' && profile) {
      const review = plan.review;
      const reviewPath = `${path}.review`;
      const total = review.today + review.recent + review.older;
      if (total !== profile.review.size)
        error(
          reviewPath,
          `${total} exercises; a ${profile.band} review has ${profile.review.size}`,
        );
      if (review.recent > 0 && review.recentDays.length === 0)
        error(reviewPath, 'recent exercises need recent days to come back to');
      if (review.older > 0 && review.olderDays.length === 0)
        error(reviewPath, 'older exercises need older days to come back to');
      for (const source of [...review.recentDays, ...review.olderDays]) {
        if (!hasMaterial(source, day.day))
          error(reviewPath, `${dayId(source)} is not an earlier day with material to review`);
      }

      const written = course.lessons.find(
        (definition) => definition.questId === questId(day.day, 'review'),
      );
      if (written?.type === 'review') {
        const planned = new Set([day.day, ...review.recentDays, ...review.olderDays]);
        const drawnFrom = new Set(
          written.exercises
            .map((item) =>
              introduced.get(
                item.source === 'vocabulary'
                  ? item.exercise.itemId
                  : item.source === 'grammar'
                    ? item.pointId
                    : item.readingId,
              ),
            )
            .filter((source): source is DayNumber => source !== undefined),
        );
        for (const source of drawnFrom) {
          if (!planned.has(source))
            warning(reviewPath, `the written review draws on ${dayId(source)}, outside its plan`);
        }
        const writtenSources = [...review.recentDays, ...review.olderDays].filter((source) =>
          [...introduced.values()].includes(source),
        );
        if (writtenSources.length > 0 && !writtenSources.some((source) => drawnFrom.has(source)))
          warning(
            reviewPath,
            `the written review draws only on ${day.id}; the plan brings back ${writtenSources.map((source) => dayId(source)).join(', ')}`,
          );
      }
    }

    // A lesson day's grammar and reading.
    if (plan.kind === 'regular') {
      const topic = topics.get(plan.grammar.topic);
      if (!topic) error(`${path}.grammar.topic`, `unknown topic "${plan.grammar.topic}"`);
      else if (levelRank(topic.level) > levelRank(day.level))
        error(
          `${path}.grammar.topic`,
          `${topic.level} topic "${topic.id}" on a ${day.level} day is too hard for it`,
        );
      for (const related of plan.grammar.related) {
        if (!topics.has(related)) error(`${path}.grammar.related`, `unknown topic "${related}"`);
      }
      if (plan.grammar.stage === 'contrast' && plan.grammar.related.length === 0)
        error(`${path}.grammar`, 'a contrast needs something to contrast with (related)');

      const reading = course.lessons.find(
        (definition) => definition.questId === questId(day.day, 'reading'),
      );
      const text = reading?.type === 'reading' ? index.readings.get(reading.readingId) : null;
      if (text) {
        const words = text.story.paragraphs.reduce(
          (sum, paragraph) => sum + wordCount(paragraph.text),
          0,
        );
        const { min, max } = plan.reading.words;
        if (words < min || words > max)
          warning(
            `${path}.reading.words`,
            `the written text has ${words} words; the plan asks for ${min}–${max}`,
          );
        const kinds = new Set(text.questions.map((question) => question.kind));
        const missing = plan.reading.skills.filter((skill) => !kinds.has(skill));
        if (missing.length > 0)
          warning(
            `${path}.reading.skills`,
            `the written questions never check ${missing.join(', ')}`,
          );
      }
    }

    // A checkpoint covers exactly the days since the previous one.
    if (plan.kind === 'weeklyExam') {
      const previous = checkpointDays.filter((checkpoint) => checkpoint < day.day).at(-1) ?? 0;
      const expected = Array.from(
        { length: day.day - previous - 1 },
        (_, position) => previous + 1 + position,
      ).filter((covered) => hasMaterial(covered, day.day));
      const { exam } = plan;
      if (exam.coveredDays.join() !== expected.join())
        error(
          `${path}.exam.coveredDays`,
          `covers ${exam.coveredDays.map((d) => dayId(d)).join(', ')}; the days since the last checkpoint are ${expected.map((d) => dayId(d)).join(', ')}`,
        );
      const sections = exam.sections.vocabulary + exam.sections.grammar + exam.sections.reading;
      if (sections !== exam.questions)
        error(
          `${path}.exam.sections`,
          `sections add up to ${sections}, not ${exam.questions} questions`,
        );
      for (const covered of exam.grammar) {
        if (!topics.has(covered)) error(`${path}.exam.grammar`, `unknown topic "${covered}"`);
      }

      const written = course.checkpoints.find((item) => item.day === day.day);
      if (written) {
        if (written.coveredDays.join() !== exam.coveredDays.join())
          warning(
            `${written.id}.coveredDays`,
            `the written exam covers ${written.coveredDays.map((d) => dayId(d)).join(', ')}; the curriculum covers ${exam.coveredDays.map((d) => dayId(d)).join(', ')}`,
          );
        const count = (section: string) =>
          written.questions.filter((question) => question.section === section).length;
        const shape = `${count('vocabulary')}/${count('grammar')}/${count('reading')}`;
        const plannedShape = `${exam.sections.vocabulary}/${exam.sections.grammar}/${exam.sections.reading}`;
        if (shape !== plannedShape)
          warning(
            `${written.id}.questions`,
            `vocabulary/grammar/reading ${shape}; the curriculum plans ${plannedShape}`,
          );
      }
    }

    // The Final Battle's blueprint adds up and samples what was taught.
    if (plan.kind === 'summit') {
      const { final } = plan;
      const sums: [string, number][] = [
        [
          'measures',
          final.measures.vocabularyRetention +
            final.measures.grammarApplication +
            final.measures.readingComprehension +
            final.measures.contextInference,
        ],
        ['sections', final.sections.vocabulary + final.sections.grammar + final.sections.reading],
        ['chapters', final.chapters.reduce((sum, item) => sum + item.questions, 0)],
      ];
      for (const [name, sum] of sums) {
        if (sum !== final.questions)
          error(`${path}.final.${name}`, `adds up to ${sum}, not ${final.questions} questions`);
      }
      if (final.grammarStrands.length !== final.sections.grammar)
        error(
          `${path}.final.grammarStrands`,
          `${final.grammarStrands.length} strands for ${final.sections.grammar} grammar questions: one question each`,
        );
      for (const item of final.chapters) {
        const sampled = chapterOf.get(item.chapterId);
        if (!sampled || sampled.startDay >= day.day)
          error(`${path}.final.chapters`, `"${item.chapterId}" is not a chapter before the summit`);
      }
      for (const strand of final.grammarStrands) {
        for (const strandTopic of strand.topics) {
          if (!topics.has(strandTopic))
            error(`${path}.final.grammarStrands`, `unknown topic "${strandTopic}"`);
        }
      }

      const written = course.finalChallenge;
      if (written) {
        const count = (section: string) =>
          written.questions.filter((question) => question.section === section).length;
        const shape = `${count('vocabulary')}/${count('grammar')}/${count('reading')}`;
        const plannedShape = `${final.sections.vocabulary}/${final.sections.grammar}/${final.sections.reading}`;
        if (shape !== plannedShape)
          warning(
            `${written.id}.questions`,
            `vocabulary/grammar/reading ${shape}; the blueprint plans ${plannedShape}`,
          );
      }
    }
  }

  // ── Grammar order: introduce, then practise, contrast, consolidate ─────────
  const firstMet = new Map<string, DayNumber>();
  const revisits = new Map<string, number>();
  for (const day of course.days) {
    const plan = day.curriculum;
    if (plan?.kind !== 'regular') continue;
    const { topic, stage, related } = plan.grammar;
    const path = `${day.id}.curriculum.grammar`;
    const known = topics.get(topic);
    if (stage === 'introduce') {
      const earlier = firstMet.get(topic);
      if (earlier !== undefined)
        error(path, `"${topic}" is introduced again (first on ${dayId(earlier)})`);
      else {
        for (const prerequisite of known?.prerequisites ?? []) {
          if (!firstMet.has(prerequisite))
            error(path, `"${topic}" comes before its prerequisite "${prerequisite}"`);
        }
        firstMet.set(topic, day.day);
      }
    } else if (!firstMet.has(topic)) {
      error(path, `"${topic}" is worked on (${stage}) before it is introduced`);
    } else {
      revisits.set(topic, (revisits.get(topic) ?? 0) + 1);
    }
    for (const item of related) {
      if (!firstMet.has(item) || firstMet.get(item) === day.day)
        error(path, `related "${item}" is not introduced before ${day.id}`);
      else revisits.set(item, (revisits.get(item) ?? 0) + 1);
    }
  }
  for (const topic of curriculum.grammarTopics) {
    if (!firstMet.has(topic.id))
      warning(`curriculum.grammarTopics[${topic.id}]`, 'no day introduces this topic');
    else if (!revisits.has(topic.id))
      warning(
        `curriculum.grammarTopics[${topic.id}]`,
        `introduced on ${dayId(firstMet.get(topic.id) ?? 1)} and never revisited`,
      );
  }

  // ── Outcomes: every chapter ends with a stated outcome ────────────────────
  const outcomeDays = new Set(curriculum.outcomes.map((outcome) => outcome.day));
  for (const chapter of chapters) {
    if (!outcomeDays.has(chapter.endDay))
      error(
        `chapters[${chapter.id}]`,
        `no learning outcome for ${dayId(chapter.endDay)}, the chapter's last day`,
      );
  }
  for (const outcome of curriculum.outcomes) {
    if (!kindOf.has(outcome.day))
      error(`curriculum.outcomes`, `outcome for ${dayId(outcome.day)}, a day the course lacks`);
  }

  return issues;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export type CurriculumStats = {
  days: { total: number; regular: number; checkpoints: number; summit: number };
  chapters: {
    id: string;
    title: string;
    band: CurriculumBand;
    days: number;
    regular: number;
    checkpoints: number;
    newWords: number;
  }[];
  newWords: number;
  grammar: {
    topics: number;
    lessons: number;
    stages: Record<GrammarStage, number>;
    byLevel: Partial<Record<CefrLevel, number>>;
    /** Later appearances per topic (practice, contrast, consolidation, or recycled alongside). */
    revisits: { min: number; average: number; max: number };
  };
  genres: Record<ReadingGenre, number>;
  bands: Record<CurriculumBand, number>;
  themes: { families: number; used: number; inTwoChaptersOrMore: number };
  /** Review exercises across all lesson days, by where their material comes from. */
  review: { today: number; recent: number; older: number };
  revisions: { day: DayNumber; reason: string }[];
};

export function curriculumStats(course: Course): CurriculumStats {
  const plans = course.days.flatMap((day) =>
    day.curriculum ? [{ day, plan: day.curriculum }] : [],
  );
  const lessons = plans.flatMap(({ day, plan }) =>
    plan.kind === 'regular' ? [{ day, plan }] : [],
  );
  const words = (days: readonly CourseDay[]) =>
    days.reduce(
      (sum, day) => sum + day.quests.reduce((inner, quest) => inner + (quest.wordCount ?? 0), 0),
      0,
    );

  const stages = Object.fromEntries(GRAMMAR_STAGES.map((stage) => [stage, 0])) as Record<
    GrammarStage,
    number
  >;
  const genres = Object.fromEntries(READING_GENRES.map((genre) => [genre, 0])) as Record<
    ReadingGenre,
    number
  >;
  const byLevel: Partial<Record<CefrLevel, number>> = {};
  const revisits = new Map<string, number>();
  for (const { plan } of lessons) {
    stages[plan.grammar.stage] += 1;
    genres[plan.reading.genre] += 1;
    if (plan.grammar.stage !== 'introduce')
      revisits.set(plan.grammar.topic, (revisits.get(plan.grammar.topic) ?? 0) + 1);
    for (const related of plan.grammar.related)
      revisits.set(related, (revisits.get(related) ?? 0) + 1);
  }
  for (const topic of course.curriculum.grammarTopics)
    byLevel[topic.level] = (byLevel[topic.level] ?? 0) + 1;
  const counts = course.curriculum.grammarTopics.map((topic) => revisits.get(topic.id) ?? 0);

  const bands = Object.fromEntries(CURRICULUM_BANDS.map((band) => [band, 0])) as Record<
    CurriculumBand,
    number
  >;
  const bandOf = new Map(course.chapters.map((chapter) => [chapter.id, chapter.band]));
  for (const day of course.days) {
    const band = bandOf.get(day.chapterId);
    if (band) bands[band] += 1;
  }

  const familyChapters = new Map<string, Set<string>>();
  for (const { day, plan } of plans) {
    const set = familyChapters.get(plan.theme.family) ?? new Set();
    set.add(day.chapterId);
    familyChapters.set(plan.theme.family, set);
  }

  const review = { today: 0, recent: 0, older: 0 };
  for (const { plan } of lessons) {
    review.today += plan.review.today;
    review.recent += plan.review.recent;
    review.older += plan.review.older;
  }

  return {
    days: {
      total: course.days.length,
      regular: course.days.filter((day) => day.kind === 'regular').length,
      checkpoints: course.days.filter((day) => day.kind === 'weeklyExam').length,
      summit: course.days.filter((day) => day.kind === 'summit').length,
    },
    chapters: [...course.chapters]
      .sort((a, b) => a.number - b.number)
      .map((chapter) => {
        const days = course.days.filter((day) => day.chapterId === chapter.id);
        return {
          id: chapter.id,
          title: chapter.title,
          band: chapter.band,
          days: days.length,
          regular: days.filter((day) => day.kind === 'regular').length,
          checkpoints: days.filter((day) => day.kind === 'weeklyExam').length,
          newWords: words(days),
        };
      }),
    newWords: words(course.days),
    grammar: {
      topics: course.curriculum.grammarTopics.length,
      lessons: lessons.length,
      stages,
      byLevel,
      revisits: {
        min: Math.min(...counts),
        average: counts.reduce((sum, count) => sum + count, 0) / Math.max(counts.length, 1),
        max: Math.max(...counts),
      },
    },
    genres,
    bands,
    themes: {
      families: course.curriculum.themes.length,
      used: familyChapters.size,
      inTwoChaptersOrMore: [...familyChapters.values()].filter((set) => set.size >= 2).length,
    },
    review,
    revisions: plans.flatMap(({ day, plan }) =>
      plan.revision ? [{ day: day.day, reason: plan.revision.reason }] : [],
    ),
  };
}

const percent = (part: number, whole: number) =>
  `${Math.round((part / Math.max(whole, 1)) * 100)}%`;

/** The curriculum part of `npm run content:validate`'s report. */
export function formatCurriculumReport(
  stats: CurriculumStats,
  issues: readonly CourseIssue[],
): string {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const reviewTotal = stats.review.today + stats.review.recent + stats.review.older;
  const lines = [
    'CURRICULUM',
    `Days             ${stats.days.total}: regular ${stats.days.regular}, checkpoints ${stats.days.checkpoints}, summit ${stats.days.summit}`,
    `Chapters         ${stats.chapters.map((chapter) => `${chapter.title} ${chapter.days} (${chapter.band})`).join(' · ')}`,
    `New words        ${stats.newWords} planned: ${stats.chapters
      .filter((chapter) => chapter.newWords > 0)
      .map((chapter) => `${chapter.title} ${chapter.newWords}`)
      .join(' · ')}`,
    `Grammar          ${stats.grammar.topics} topics, ${stats.grammar.lessons} lessons: ${GRAMMAR_STAGES.map((stage) => `${stage} ${stats.grammar.stages[stage]}`).join(', ')}`,
    `                 revisits per topic ${stats.grammar.revisits.min}–${stats.grammar.revisits.max} (average ${stats.grammar.revisits.average.toFixed(1)})`,
    `Reading          ${READING_GENRES.filter((genre) => stats.genres[genre] > 0)
      .map((genre) => `${genre} ${stats.genres[genre]}`)
      .join(', ')}`,
    `Difficulty       ${CURRICULUM_BANDS.map((band) => `${band} ${stats.bands[band]} days`).join(' · ')}`,
    `Themes           ${stats.themes.used} of ${stats.themes.families} families used, ${stats.themes.inTwoChaptersOrMore} come back in another chapter`,
    `Review mix       today ${percent(stats.review.today, reviewTotal)} · recent ${percent(stats.review.recent, reviewTotal)} · older ${percent(stats.review.older, reviewTotal)}`,
  ];
  if (stats.revisions.length > 0) {
    lines.push(
      '',
      `NEEDS_CONTENT_REVISION: ${stats.revisions.map((revision) => dayId(revision.day)).join(', ')}`,
    );
  }
  lines.push('');
  if (warnings.length > 0)
    lines.push(`${warnings.length} warning(s):`, ...warnings.map(formatIssue), '');
  lines.push(errors.length > 0 ? `${errors.length} error(s):` : 'No errors.');
  lines.push(...errors.map(formatIssue));
  return lines.join('\n');
}
