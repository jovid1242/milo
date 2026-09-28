import type { z } from 'zod';

import {
  CEFR_LEVELS,
  CourseSchema,
  QuestContentSchema,
  type CefrLevel,
  type Course,
  type DayNumber,
  type Exam,
} from '@/schemas';

import { introductionDays, indexCourse, type CourseIndex } from './course-index';
import { FINAL_CHALLENGE_ID, dayId, questId, weeklyExamId } from './ids';
import { resolveQuestContent } from './resolve';

/**
 * Validates a whole course before anything uses it — the bundled one at
 * startup and in CI, a downloaded one later. Two layers:
 *
 * 1. Zod: every entity's shape (a malformed quest, an answer that is not
 *    among its options, an empty list that must not be empty).
 * 2. Rules across the course: ids unique and references resolvable, days and
 *    chapters consistent, material taught before it is reviewed or tested,
 *    levels that never go down, rewards that match their quests, and every
 *    quest resolving into content the game can play.
 *
 * Every issue names where it is, by id: `d014-review.exercises[3].itemId`.
 */

export type CourseIssueSeverity = 'error' | 'warning';

export type CourseIssue = {
  severity: CourseIssueSeverity;
  /** Where, by id: `d014-review.exercises[3].itemId`. */
  path: string;
  message: string;
};

export type CourseValidation = {
  /** No errors (warnings allowed). */
  ok: boolean;
  /** The parsed course; `null` when its shape is already wrong. */
  course: Course | null;
  issues: CourseIssue[];
};

export type ValidateOptions = {
  /** The app's day count — a course with another length cannot run here. */
  expectedTotalDays?: number;
};

// ── Zod issues, with id-based paths ──────────────────────────────────────────

const COLLECTION_KEYS: Record<string, string> = {
  chapters: 'id',
  days: 'id',
  vocabulary: 'id',
  grammar: 'id',
  readings: 'id',
  lessons: 'questId',
  checkpoints: 'id',
};

function renderPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') return `${path}[${segment}]`;
    return path ? `${path}.${String(segment)}` : String(segment);
  }, '');
}

/** `lessons.12.exercises.3` → `d014-review.exercises[3]`, when the entity has an id. */
function zodPath(input: unknown, segments: readonly PropertyKey[]): string {
  const [collection, position, ...rest] = segments;
  if (typeof collection === 'string') {
    if (collection === 'finalChallenge')
      return renderPath([FINAL_CHALLENGE_ID, ...segments.slice(1)]);
    const key = COLLECTION_KEYS[collection];
    if (key && typeof position === 'number') {
      const list = (input as Record<string, unknown> | null)?.[collection];
      const entity = Array.isArray(list) ? (list[position] as Record<string, unknown>) : undefined;
      const id = entity?.[key];
      if (typeof id === 'string' && id.length > 0) return renderPath([id, ...rest]);
    }
  }
  return renderPath(segments.length > 0 ? segments : ['course']);
}

function zodIssues(input: unknown, error: z.ZodError): CourseIssue[] {
  return error.issues.map((issue) => ({
    severity: 'error',
    path: zodPath(input, issue.path),
    message: issue.message,
  }));
}

// ── Rules across the course ──────────────────────────────────────────────────

class Issues {
  readonly list: CourseIssue[] = [];
  error(path: string, message: string) {
    this.list.push({ severity: 'error', path, message });
  }
  warning(path: string, message: string) {
    this.list.push({ severity: 'warning', path, message });
  }
}

const levelRank = (level: CefrLevel) => CEFR_LEVELS.indexOf(level);

/** One id space for the whole course: course-wide ids never repeat. */
function checkIds(course: Course, issues: Issues) {
  const seen = new Map<string, string>();
  const claim = (id: string, path: string) => {
    const first = seen.get(id);
    if (first !== undefined) issues.error(path, `duplicate id "${id}" (also ${first})`);
    else seen.set(id, path);
  };
  claim(course.id, 'course.id');
  course.chapters.forEach((chapter, index) => claim(chapter.id, `chapters[${index}]`));
  course.days.forEach((day) => {
    claim(day.id, `${day.id}`);
    day.quests.forEach((quest, index) => claim(quest.id, `${day.id}.quests[${index}]`));
  });
  course.vocabulary.forEach((word) => claim(word.id, `vocabulary[${word.id}]`));
  course.grammar.forEach((lesson) => {
    claim(lesson.id, `grammar[${lesson.id}]`);
    lesson.rule.points.forEach((point, index) =>
      claim(point.id, `${lesson.id}.rule.points[${index}]`),
    );
    lesson.examples.forEach((example, index) =>
      claim(example.id, `${lesson.id}.examples[${index}]`),
    );
    lesson.exercises.forEach((exercise, index) =>
      claim(exercise.id, `${lesson.id}.exercises[${index}]`),
    );
  });
  course.readings.forEach((reading) => {
    claim(reading.id, `readings[${reading.id}]`);
    reading.questions.forEach((question, index) =>
      claim(question.id, `${reading.id}.questions[${index}]`),
    );
  });
  course.lessons.forEach((definition) => {
    if (definition.type === 'vocabulary') {
      definition.exercises.forEach((exercise, index) =>
        claim(exercise.id, `${definition.questId}.exercises[${index}]`),
      );
    } else if (definition.type === 'review') {
      definition.exercises.forEach((item, index) =>
        claim(
          item.source === 'reading' ? item.question.id : item.exercise.id,
          `${definition.questId}.exercises[${index}]`,
        ),
      );
    }
  });
  const exams: Exam[] = [
    ...course.checkpoints,
    ...(course.finalChallenge ? [course.finalChallenge] : []),
  ];
  exams.forEach((exam) => {
    claim(exam.id, `${exam.id}`);
    exam.questions.forEach((question, index) =>
      claim(question.id, `${exam.id}.questions[${index}]`),
    );
  });

  // Naming convention for bank material: the prefix says what an id is.
  course.vocabulary.forEach((word) => {
    if (!word.id.startsWith('vocab-'))
      issues.error(`vocabulary[${word.id}]`, 'word ids are "vocab-<lemma>"');
  });
  course.grammar.forEach((lesson) => {
    if (!lesson.id.startsWith('grammar-'))
      issues.error(`grammar[${lesson.id}]`, 'grammar lesson ids are "grammar-<topic>"');
  });
  course.readings.forEach((reading) => {
    if (!reading.id.startsWith('reading-'))
      issues.error(`readings[${reading.id}]`, 'reading ids are "reading-<slug>"');
  });
}

/** Days, chapters, kinds and levels: the shape of the ninety days. */
function checkPlan(course: Course, issues: Issues, options: ValidateOptions) {
  if (options.expectedTotalDays !== undefined && course.totalDays !== options.expectedTotalDays) {
    issues.error(
      'course.totalDays',
      `the course has ${course.totalDays} days but the app runs ${options.expectedTotalDays}`,
    );
  }
  if (course.days.length !== course.totalDays) {
    issues.error(
      'course.days',
      `${course.days.length} days defined for a ${course.totalDays}-day course`,
    );
  }

  const byNumber = new Map<number, string>();
  course.days.forEach((day, index) => {
    const path = day.id || `days[${index}]`;
    if (day.day < 1 || day.day > course.totalDays) {
      issues.error(`${path}.day`, `day ${day.day} is outside 1–${course.totalDays}`);
    }
    const twin = byNumber.get(day.day);
    if (twin) issues.error(`${path}.day`, `day ${day.day} is defined twice (also ${twin})`);
    byNumber.set(day.day, path);
    if (day.id !== dayId(day.day))
      issues.error(`${path}.id`, `day ${day.day} must have id "${dayId(day.day)}"`);
    day.quests.forEach((quest, position) => {
      if (quest.id !== questId(day.day, quest.type)) {
        issues.error(
          `${path}.quests[${position}].id`,
          `a ${quest.type} quest of day ${day.day} must have id "${questId(day.day, quest.type)}"`,
        );
      }
    });
    if (index > 0 && (course.days[index - 1]?.day ?? 0) >= day.day) {
      issues.error(`${path}.day`, 'days must be listed in order');
    }
  });
  for (let day = 1; day <= course.totalDays; day += 1) {
    if (!byNumber.has(day)) issues.error(`course.days`, `day ${day} is missing`);
  }

  // Chapters: in order, back to back, covering every day exactly once.
  const chapters = [...course.chapters].sort((a, b) => a.startDay - b.startDay);
  chapters.forEach((chapter, index) => {
    const path = `chapters[${chapter.id}]`;
    const expectedStart = index === 0 ? 1 : (chapters[index - 1]?.endDay ?? 0) + 1;
    if (chapter.startDay !== expectedStart) {
      issues.error(
        `${path}.startDay`,
        `starts on day ${chapter.startDay}; the chapter before ends on day ${expectedStart - 1}`,
      );
    }
    if (chapter.number !== index + 1)
      issues.error(`${path}.number`, `chapter ${index + 1} is numbered ${chapter.number}`);
  });
  const last = chapters.at(-1);
  if (last && last.endDay !== course.totalDays) {
    issues.error(
      `chapters[${last.id}].endDay`,
      `the last chapter ends on day ${last.endDay}, not ${course.totalDays}`,
    );
  }
  course.days.forEach((day) => {
    const chapter = course.chapters.find((item) => item.id === day.chapterId);
    if (!chapter) {
      issues.error(`${day.id}.chapterId`, `unknown chapter "${day.chapterId}"`);
    } else if (day.day < chapter.startDay || day.day > chapter.endDay) {
      const right = course.chapters.find(
        (item) => day.day >= item.startDay && day.day <= item.endDay,
      );
      issues.error(
        `${day.id}.chapterId`,
        `day ${day.day} is in chapter "${right?.id ?? '?'}", not "${day.chapterId}" (days ${chapter.startDay}–${chapter.endDay})`,
      );
    }
  });

  // Kinds: what each kind of day is made of; one summit, and it is the last day.
  const summits = course.days.filter((day) => day.kind === 'summit');
  if (summits.length !== 1)
    issues.error('course.days', `${summits.length} summit days; the course has exactly one`);
  course.days.forEach((day) => {
    const types = day.quests.map((quest) => quest.type);
    const exams = types.filter((type) => type === 'weeklyExam' || type === 'finalBattle');
    if (day.kind === 'summit') {
      if (day.day !== course.totalDays)
        issues.error(
          `${day.id}.kind`,
          `the summit is the last day (${course.totalDays}), not day ${day.day}`,
        );
      if (types.length !== 1 || types[0] !== 'finalBattle')
        issues.error(`${day.id}.quests`, 'the summit day is the Final Battle alone');
    } else if (day.kind === 'weeklyExam') {
      if (types.at(-1) !== 'weeklyExam' || exams.length !== 1)
        issues.error(
          `${day.id}.quests`,
          'a checkpoint day ends with its weekly exam, and has only that exam',
        );
    } else if (exams.length > 0) {
      issues.error(`${day.id}.quests`, 'a regular day has no exams');
    }
  });

  // Levels never go down.
  let highest: { level: CefrLevel; day: string } | null = null;
  for (const day of course.days) {
    if (highest && levelRank(day.level) < levelRank(highest.level)) {
      issues.error(
        `${day.id}.level`,
        `${day.level} after ${highest.day} was already ${highest.level}: the course never gets easier`,
      );
    }
    if (!highest || levelRank(day.level) > levelRank(highest.level))
      highest = { level: day.level, day: day.id };
  }
}

/** Material a day teaches must suit the day: its level, or one step below. */
function checkMaterialLevel(
  path: string,
  level: CefrLevel | undefined,
  dayLevel: CefrLevel,
  issues: Issues,
) {
  if (!level) return;
  const gap = levelRank(dayLevel) - levelRank(level);
  if (gap < 0) issues.error(path, `${level} material on a ${dayLevel} day is too hard for it`);
  else if (gap > 1)
    issues.error(
      path,
      `${level} material on a ${dayLevel} day is easier than the course is by then`,
    );
}

/** Daily quests' content: references, first teachings, reviews of what came before. */
function checkLessons(index: CourseIndex, introduced: Map<string, DayNumber>, issues: Issues) {
  const { course } = index;
  const taughtBy = new Map<string, string>();
  const teach = (materialId: string, quest: string, path: string) => {
    const earlier = taughtBy.get(materialId);
    if (earlier)
      issues.error(
        path,
        `"${materialId}" is already taught by ${earlier}; later days review it instead`,
      );
    else taughtBy.set(materialId, quest);
  };
  const beforeOrOn = (materialId: string, day: DayNumber, path: string, what: string) => {
    const taught = introduced.get(materialId);
    if (taught === undefined)
      issues.error(path, `${what} "${materialId}" is never taught by any quest`);
    else if (taught > day)
      issues.error(
        path,
        `${what} "${materialId}" is taught on ${dayId(taught)}, after ${dayId(day)}`,
      );
  };

  const seen = new Set<string>();
  for (const definition of course.lessons) {
    const q = definition.questId;
    if (seen.has(q)) issues.error(q, 'this quest has content twice');
    seen.add(q);
    const slot = index.slots.get(q);
    if (!slot) {
      issues.error(q, 'no quest with this id in the course plan');
      continue;
    }
    if (slot.type !== definition.type) {
      issues.error(
        `${q}.type`,
        `the plan's quest is ${slot.type}, the content is ${definition.type}`,
      );
      continue;
    }
    const day = index.days.get(slot.day);
    const dayLevel = day?.level ?? 'A1';

    switch (definition.type) {
      case 'vocabulary': {
        definition.wordIds.forEach((id, position) => {
          const path = `${q}.wordIds[${position}]`;
          const word = index.words.get(id);
          if (!word) return issues.error(path, `unknown vocabulary id "${id}"`);
          teach(id, q, path);
          checkMaterialLevel(path, word.level, dayLevel, issues);
        });
        if (slot.wordCount !== undefined && slot.wordCount !== definition.wordIds.length) {
          issues.error(
            `${q}.wordIds`,
            `the plan promises ${slot.wordCount} new words, the quest teaches ${definition.wordIds.length}`,
          );
        }
        break;
      }
      case 'grammar': {
        const lesson = index.lessons.get(definition.lessonId);
        if (!lesson) {
          issues.error(`${q}.lessonId`, `unknown grammar lesson "${definition.lessonId}"`);
          break;
        }
        teach(lesson.id, q, `${q}.lessonId`);
        checkMaterialLevel(`${q}.lessonId`, lesson.level, dayLevel, issues);
        break;
      }
      case 'reading': {
        const reading = index.readings.get(definition.readingId);
        if (!reading) {
          issues.error(`${q}.readingId`, `unknown reading "${definition.readingId}"`);
          break;
        }
        teach(reading.id, q, `${q}.readingId`);
        checkMaterialLevel(`${q}.readingId`, reading.story.level, dayLevel, issues);
        break;
      }
      case 'review': {
        definition.exercises.forEach((item, position) => {
          const path = `${q}.exercises[${position}]`;
          if (item.source === 'vocabulary') {
            const { itemId, optionItemIds } = item.exercise;
            [itemId, ...optionItemIds].forEach((id) => {
              if (!index.words.has(id))
                issues.error(`${path}.itemId`, `unknown vocabulary id "${id}"`);
              else beforeOrOn(id, slot.day, `${path}.itemId`, 'word');
            });
          } else if (item.source === 'grammar') {
            if (!index.points.has(item.pointId))
              issues.error(`${path}.pointId`, `unknown grammar point "${item.pointId}"`);
            else beforeOrOn(item.pointId, slot.day, `${path}.pointId`, 'grammar point');
          } else {
            const reading = index.readings.get(item.readingId);
            if (!reading)
              return issues.error(`${path}.readingId`, `unknown reading "${item.readingId}"`);
            beforeOrOn(item.readingId, slot.day, `${path}.readingId`, 'reading');
            if (item.snippet) {
              const paragraph = reading.story.paragraphs.find(
                (p) => p.id === item.snippet?.paragraphId,
              );
              if (!paragraph)
                issues.error(
                  `${path}.snippet`,
                  `"${item.readingId}" has no paragraph "${item.snippet.paragraphId}"`,
                );
            }
          }
        });
        break;
      }
    }
  }

  // Bank material nothing teaches is dead weight — or a quest that was forgotten.
  const orphan = (id: string, path: string) => {
    if (!taughtBy.has(id)) issues.warning(path, `"${id}" is in the course but no quest teaches it`);
  };
  course.vocabulary.forEach((word) => orphan(word.id, `vocabulary[${word.id}]`));
  course.grammar.forEach((lesson) => orphan(lesson.id, `grammar[${lesson.id}]`));
  course.readings.forEach((reading) => orphan(reading.id, `readings[${reading.id}]`));

  // Highlighted words that point at the vocabulary bank must point at a word
  // taught by then — a text never explains a word "from the future".
  for (const reading of course.readings) {
    const day = introduced.get(reading.id);
    reading.story.words.forEach((gloss, position) => {
      if (!gloss.vocabularyId) return;
      const path = `${reading.id}.story.words[${position}].vocabularyId`;
      if (!index.words.has(gloss.vocabularyId))
        issues.error(path, `unknown vocabulary id "${gloss.vocabularyId}"`);
      else if (day !== undefined) beforeOrOn(gloss.vocabularyId, day, path, 'word');
    });
  }
}

/** Weekly exams and the Final Battle: where they sit, what they cover, what they pay. */
function checkExams(index: CourseIndex, introduced: Map<string, DayNumber>, issues: Issues) {
  const { course } = index;
  const written = new Set(
    course.lessons.map((definition) => index.slots.get(definition.questId)?.day),
  );
  const exams: Exam[] = [
    ...course.checkpoints,
    ...(course.finalChallenge ? [course.finalChallenge] : []),
  ];
  const seen = new Map<string, string>();

  for (const exam of exams) {
    const path = exam.id;
    const twin = seen.get(exam.questId);
    if (twin) issues.error(`${path}.questId`, `${exam.questId} already has an exam (${twin})`);
    seen.set(exam.questId, exam.id);

    const slot = index.slots.get(exam.questId);
    const expectedType = exam.type;
    if (!slot) {
      issues.error(`${path}.questId`, `no quest "${exam.questId}" in the course plan`);
      continue;
    }
    if (slot.type !== expectedType)
      issues.error(
        `${path}.questId`,
        `"${exam.questId}" is a ${slot.type} quest, not a ${expectedType}`,
      );
    if (slot.day !== exam.day)
      issues.error(`${path}.day`, `the exam says day ${exam.day}, its quest is on day ${slot.day}`);
    if (slot.xpReward !== exam.xpReward)
      issues.error(
        `${path}.xpReward`,
        `pays ${exam.xpReward} XP but its quest shows ${slot.xpReward}`,
      );
    if (slot.estimatedMinutes !== exam.estimatedMinutes) {
      issues.error(
        `${path}.estimatedMinutes`,
        `takes ${exam.estimatedMinutes} min but its quest shows ${slot.estimatedMinutes}`,
      );
    }
    if (exam.type === 'weeklyExam') {
      const day = index.days.get(exam.day);
      if (day && day.week !== exam.week)
        issues.error(`${path}.week`, `day ${exam.day} is in week ${day.week}, not ${exam.week}`);
      if (exam.id !== weeklyExamId(exam.week))
        issues.error(
          `${path}.id`,
          `week ${exam.week}'s exam must have id "${weeklyExamId(exam.week)}"`,
        );
    } else {
      if (exam.id !== FINAL_CHALLENGE_ID)
        issues.error(`${path}.id`, `the Final Battle's id is "${FINAL_CHALLENGE_ID}"`);
      if (exam.day !== course.totalDays)
        issues.error(`${path}.day`, `the Final Battle is on the last day, ${course.totalDays}`);
    }

    const unwritten = exam.coveredDays.filter((day) => !written.has(day));
    if (unwritten.length > 0) {
      issues.warning(
        `${path}.coveredDays`,
        `covers ${unwritten.length} day(s) with no lessons yet: ${unwritten.map((day) => dayId(day)).join(', ')}`,
      );
    }

    exam.questions.forEach((question, position) => {
      (question.materialIds ?? []).forEach((id, ref) => {
        const refPath = `${path}.questions[${position}].materialIds[${ref}]`;
        const known =
          index.words.has(id) ||
          index.points.has(id) ||
          index.readings.has(id) ||
          index.lessons.has(id);
        const taught = introduced.get(id);
        if (!known) issues.error(refPath, `unknown material "${id}"`);
        else if (taught === undefined)
          issues.error(refPath, `"${id}" is never taught by any quest`);
        else if (taught > question.sourceDay) {
          issues.error(
            refPath,
            `"${id}" is taught on ${dayId(taught)}, after the question's source day ${question.sourceDay}`,
          );
        } else if (taught >= exam.day) {
          issues.error(
            refPath,
            `"${id}" is taught on ${dayId(taught)} — not before the exam on ${dayId(exam.day)}`,
          );
        }
      });
    });
  }

  const finalSlot = course.days.find((day) => day.kind === 'summit')?.quests[0];
  if (finalSlot && !course.finalChallenge) {
    issues.warning(finalSlot.id, 'the Final Battle has no content yet');
  }
}

/** The last word: every quest with content must turn into content the game can play. */
function checkPlayable(index: CourseIndex, issues: Issues) {
  for (const quest of index.slots.values()) {
    let content;
    try {
      content = resolveQuestContent(index, quest.id);
    } catch (error: unknown) {
      issues.error(quest.id, error instanceof Error ? error.message : String(error));
      continue;
    }
    if (!content) continue;
    const parsed = QuestContentSchema.safeParse(content);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        issues.error(renderPath([quest.id, ...issue.path]), `not playable: ${issue.message}`),
      );
    }
  }
}

export function validateCourse(input: unknown, options: ValidateOptions = {}): CourseValidation {
  const parsed = CourseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, course: null, issues: zodIssues(input, parsed.error) };
  }
  const course = parsed.data;
  const issues = new Issues();
  const index = indexCourse(course);
  const introduced = introductionDays(index);

  checkIds(course, issues);
  checkPlan(course, issues, options);
  checkLessons(index, introduced, issues);
  checkExams(index, introduced, issues);
  checkPlayable(index, issues);

  return {
    ok: !issues.list.some((issue) => issue.severity === 'error'),
    course,
    issues: issues.list,
  };
}

/** One line per issue, for logs and the CLI. */
export function formatIssue(issue: CourseIssue): string {
  return `${issue.severity === 'error' ? 'ERROR' : 'warn '} ${issue.path}: ${issue.message}`;
}
