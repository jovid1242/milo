import {
  READING_GENRES,
  type Course,
  type CourseDay,
  type GrammarStage,
  type ReadingQuestionKind,
} from '@/schemas';

import { curriculumStats } from './curriculum';
import { indexCourse } from './course-index';
import { dayId } from './ids';

/**
 * The generated parts of docs/CURRICULUM_90_DAY.md: rendered from the same
 * course data the validator reads, so the document never drifts from the
 * machine-readable map. `npm run curriculum:doc` writes them; a test fails
 * when they are out of date.
 *
 * Tables are printed the way Prettier formats Markdown, so formatting the
 * document changes nothing.
 */

export type CurriculumDocSection =
  'bands' | 'grammar' | 'day-map' | 'checkpoints' | 'final' | 'outcomes' | 'stats';

const SKILL_NAMES: Record<ReadingQuestionKind, string> = {
  mainIdea: 'main idea',
  detail: 'detail',
  inference: 'inference',
  context: 'context',
};

const cellWidth = (text: string) => [...text].length;

/** A Markdown table, padded exactly as Prettier pads it. */
function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  for (const cell of [...header, ...rows.flat()]) {
    if (cell.includes('|')) throw new Error(`A table cell cannot contain "|": ${cell}`);
  }
  const widths = header.map((cell, column) =>
    Math.max(3, cellWidth(cell), ...rows.map((row) => cellWidth(row[column] ?? ''))),
  );
  const line = (cells: readonly string[]) =>
    `| ${cells
      .map((cell, column) => cell + ' '.repeat((widths[column] ?? 0) - cellWidth(cell)))
      .join(' | ')} |`;
  return [
    line(header),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(line),
  ].join('\n');
}

const dayRange = (days: readonly number[]) =>
  days.length === 0
    ? '—'
    : days.length === 1
      ? dayId(days[0] ?? 1)
      : `${dayId(days[0] ?? 1)}–${dayId(days.at(-1) ?? 1)}`;

/** A day's content status: written, planned, or written but no longer fitting. */
function statusOf(written: ReadonlySet<string>, day: CourseDay): string {
  if (day.curriculum?.revision) return 'NEEDS_CONTENT_REVISION';
  return day.quests.every((quest) => written.has(quest.id)) ? 'written' : 'planned';
}

/** Quests whose content exists. */
function writtenQuests(course: Course): Set<string> {
  const index = indexCourse(course);
  return new Set([...index.definitions.keys(), ...index.exams.keys()]);
}

function reviewCell(day: CourseDay): string {
  const plan = day.curriculum;
  if (!plan || plan.kind === 'summit') return '—';
  const { review } = plan;
  if (plan.kind === 'weeklyExam') return `${review.today} today · ${review.recent} from the week`;
  const parts = [`${review.today} today`];
  if (review.recent > 0)
    parts.push(`${review.recent} from ${review.recentDays.map((d) => dayId(d)).join(', ')}`);
  if (review.older > 0)
    parts.push(`${review.older} from ${review.olderDays.map((d) => dayId(d)).join(', ')}`);
  return parts.join(' · ');
}

function renderBands(course: Course): string {
  return table(
    ['Band', 'CEFR', 'Chapters', 'Reading', 'Questions', 'Review', 'Russian'],
    course.curriculum.bands.map((profile) => [
      profile.band,
      profile.level,
      course.chapters
        .filter((chapter) => chapter.band === profile.band)
        .map((chapter) => chapter.title)
        .join(', '),
      `${profile.readingWords.min}–${profile.readingWords.max} words; ${profile.readingSkills
        .map((skill) => SKILL_NAMES[skill])
        .join(', ')}`,
      profile.readingQuestions.min === profile.readingQuestions.max
        ? `${profile.readingQuestions.min}`
        : `${profile.readingQuestions.min}–${profile.readingQuestions.max}`,
      `${profile.review.size} (${profile.review.today} today)`,
      profile.support,
    ]),
  );
}

function renderGrammar(course: Course): string {
  const titleOf = new Map(course.curriculum.grammarTopics.map((topic) => [topic.id, topic.title]));
  return table(
    ['Topic', 'Level', 'Needs', 'Introduced', 'Later'],
    course.curriculum.grammarTopics.map((topic) => {
      const appearances = course.days.flatMap(
        (day): { day: CourseDay; stage: GrammarStage | 'recycled' }[] => {
          const plan = day.curriculum;
          if (plan?.kind !== 'regular') return [];
          if (plan.grammar.topic === topic.id) return [{ day, stage: plan.grammar.stage }];
          return plan.grammar.related.includes(topic.id) ? [{ day, stage: 'recycled' }] : [];
        },
      );
      const introduced = appearances.find((item) => item.stage === 'introduce');
      return [
        topic.title,
        topic.level,
        topic.prerequisites.map((id) => titleOf.get(id) ?? id).join(', ') || '—',
        introduced ? introduced.day.id : '—',
        appearances
          .filter((item) => item !== introduced)
          .map((item) => `${item.day.id} ${item.stage}`)
          .join(', ') || '—',
      ];
    }),
  );
}

function renderDayMap(course: Course): string {
  const written = writtenQuests(course);
  const topicTitle = new Map(
    course.curriculum.grammarTopics.map((topic) => [topic.id, topic.title]),
  );
  return [...course.chapters]
    .sort((a, b) => a.number - b.number)
    .map((chapter) => {
      const rows = course.days
        .filter((day) => day.chapterId === chapter.id)
        .map((day): string[] => {
          const plan = day.curriculum;
          if (!plan) return [day.id, '—', '—', '—', '—', '—', statusOf(written, day)];
          const theme = `${plan.theme.title} (${plan.theme.family})`;
          switch (plan.kind) {
            case 'regular':
              return [
                day.id,
                theme,
                `${plan.vocabulary.focus} — e.g. ${plan.vocabulary.examples.join(', ')}`,
                `${topicTitle.get(plan.grammar.topic) ?? plan.grammar.topic} · ${plan.grammar.stage}: ${plan.grammar.objective}`,
                `${plan.reading.genre}: ${plan.reading.topic} (${plan.reading.words.min}–${plan.reading.words.max} words)`,
                reviewCell(day),
                statusOf(written, day),
              ];
            case 'weeklyExam':
              return [
                day.id,
                `CHECKPOINT · ${theme}`,
                `${plan.vocabulary.focus} — e.g. ${plan.vocabulary.examples.join(', ')}`,
                `Week ${day.week} exam: ${plan.exam.questions} questions over ${dayRange(plan.exam.coveredDays)}`,
                '—',
                reviewCell(day),
                statusOf(written, day),
              ];
            case 'summit':
              return [
                day.id,
                `SUMMIT · ${theme}`,
                '—',
                `Final Battle: ${plan.final.questions} questions over the whole course`,
                '—',
                '—',
                statusOf(written, day),
              ];
          }
        });
      return [
        `### Chapter ${chapter.number} · ${chapter.title} — Days ${chapter.startDay}–${chapter.endDay} · ${chapter.band}`,
        '',
        chapter.purpose,
        '',
        table(['Day', 'Theme', 'Vocabulary', 'Grammar', 'Reading', 'Review', 'Status'], rows),
      ].join('\n');
    })
    .join('\n\n');
}

function renderCheckpoints(course: Course): string {
  const topicTitle = new Map(
    course.curriculum.grammarTopics.map((topic) => [topic.id, topic.title]),
  );
  const familyTitle = new Map(course.curriculum.themes.map((family) => [family.id, family.title]));
  return course.days
    .flatMap((day) => {
      const plan = day.curriculum;
      if (plan?.kind !== 'weeklyExam') return [];
      const { exam } = plan;
      const lines = [
        `### Week ${day.week} · ${day.id} — ${plan.theme.title}`,
        '',
        `- Objective: ${exam.objective}`,
        `- Covers: ${dayRange(exam.coveredDays)}`,
        `- Questions: ${exam.questions} — vocabulary ${exam.sections.vocabulary}, grammar ${exam.sections.grammar}, reading ${exam.sections.reading}`,
        `- Themes: ${exam.themes.map((id) => familyTitle.get(id) ?? id).join('; ')}`,
        `- Grammar: ${exam.grammar.map((id) => topicTitle.get(id) ?? id).join('; ')}`,
        `- Reading skills: ${exam.readingSkills.map((skill) => SKILL_NAMES[skill]).join(', ')}`,
        '- Must retain:',
        ...exam.mustRetain.map((item) => `  - ${item}`),
      ];
      if (plan.revision) lines.push(`- NEEDS_CONTENT_REVISION: ${plan.revision.reason}`);
      return [lines.join('\n')];
    })
    .join('\n\n');
}

function renderFinal(course: Course): string {
  const summit = course.days.find((day) => day.curriculum?.kind === 'summit');
  const plan = summit?.curriculum;
  if (plan?.kind !== 'summit') return 'No Final Battle blueprint.';
  const { final } = plan;
  const topicTitle = new Map(
    course.curriculum.grammarTopics.map((topic) => [topic.id, topic.title]),
  );
  const chapterTitle = new Map(course.chapters.map((chapter) => [chapter.id, chapter.title]));
  const lines = [
    `- Objective: ${final.objective}`,
    `- Questions: ${final.questions}, ${final.passages} reading passages`,
    `- Measures: vocabulary retention ${final.measures.vocabularyRetention} · grammar application ${final.measures.grammarApplication} · reading comprehension ${final.measures.readingComprehension} · context and inference ${final.measures.contextInference}`,
    `- Sections: vocabulary ${final.sections.vocabulary} · grammar ${final.sections.grammar} · reading ${final.sections.reading}`,
    `- Chapters: ${final.chapters.map((item) => `${chapterTitle.get(item.chapterId) ?? item.chapterId} ${item.questions}`).join(' · ')}`,
    '- Grammar strands, one question each:',
    ...final.grammarStrands.map(
      (strand) =>
        `  - ${strand.title}: ${strand.topics.map((id) => topicTitle.get(id) ?? id).join(', ')}`,
    ),
  ];
  if (plan.revision) lines.push(`- NEEDS_CONTENT_REVISION: ${plan.revision.reason}`);
  return lines.join('\n');
}

function renderOutcomes(course: Course): string {
  return course.curriculum.outcomes
    .map((outcome) =>
      [
        `### ${dayId(outcome.day)} · ${outcome.title}`,
        '',
        ...outcome.canDo.map((item) => `- ${item}`),
      ].join('\n'),
    )
    .join('\n\n');
}

function renderStats(course: Course): string {
  const stats = curriculumStats(course);
  const reviewTotal = stats.review.today + stats.review.recent + stats.review.older;
  const share = (part: number) => `${Math.round((part / Math.max(reviewTotal, 1)) * 100)}%`;
  return [
    table(
      ['Chapter', 'Band', 'Days', 'Lesson days', 'Checkpoints', 'New words'],
      stats.chapters.map((chapter) => [
        chapter.title,
        chapter.band,
        `${chapter.days}`,
        `${chapter.regular}`,
        `${chapter.checkpoints}`,
        `${chapter.newWords}`,
      ]),
    ),
    '',
    `- Days: ${stats.days.total} — ${stats.days.regular} lesson days, ${stats.days.checkpoints} checkpoints, ${stats.days.summit} summit`,
    `- New words planned: ${stats.newWords}`,
    `- Grammar: ${stats.grammar.topics} topics over ${stats.grammar.lessons} lessons — introduce ${stats.grammar.stages.introduce}, practice ${stats.grammar.stages.practice}, contrast ${stats.grammar.stages.contrast}, consolidate ${stats.grammar.stages.consolidate}; each topic comes back ${stats.grammar.revisits.min}–${stats.grammar.revisits.max} times (average ${stats.grammar.revisits.average.toFixed(1)})`,
    `- Reading genres: ${READING_GENRES.map((genre) => `${genre} ${stats.genres[genre]}`).join(', ')}`,
    `- Difficulty: ${Object.entries(stats.bands)
      .map(([band, days]) => `${band} ${days} days`)
      .join(', ')}`,
    `- Themes: ${stats.themes.used} families, ${stats.themes.inTwoChaptersOrMore} of them come back in another chapter`,
    `- Review exercises: ${share(stats.review.today)} today, ${share(stats.review.recent)} recent, ${share(stats.review.older)} older`,
    `- NEEDS_CONTENT_REVISION: ${stats.revisions.map((revision) => dayId(revision.day)).join(', ') || 'none'}`,
  ].join('\n');
}

export function renderCurriculumSections(course: Course): Record<CurriculumDocSection, string> {
  return {
    bands: renderBands(course),
    grammar: renderGrammar(course),
    'day-map': renderDayMap(course),
    checkpoints: renderCheckpoints(course),
    final: renderFinal(course),
    outcomes: renderOutcomes(course),
    stats: renderStats(course),
  };
}

/** Replaces each `<!-- curriculum:name -->…<!-- /curriculum:name -->` block's content. */
export function updateGeneratedSections(
  doc: string,
  sections: Record<CurriculumDocSection, string>,
): string {
  return Object.entries(sections).reduce((text, [name, content]) => {
    const start = `<!-- curriculum:${name} -->`;
    const end = `<!-- /curriculum:${name} -->`;
    const from = text.indexOf(start);
    const to = text.indexOf(end);
    if (from < 0 || to < from) throw new Error(`The document has no ${start} … ${end} block`);
    return `${text.slice(0, from + start.length)}\n\n${content}\n\n${text.slice(to)}`;
  }, doc);
}
