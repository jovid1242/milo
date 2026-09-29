import type {
  BandProfile,
  Chapter,
  CheckpointObjective,
  CourseDay,
  DayCurriculum,
  DayNumber,
  ReadingQuestionKind,
  ReviewPlan,
} from '@/schemas';
import { ReadingQuestionKindSchema } from '@/schemas';

import type { CheckpointDayDraft, DayDraft, RegularDayDraft } from './types';

/**
 * Turns the authored drafts into each day's curriculum, reading the course
 * plan as the source of truth: which days are checkpoints, which is the
 * summit, which chapter (and so which band) a day is in. Never throws — a day
 * without a draft simply has no curriculum, and the curriculum validator says so.
 */

/**
 * Spaced repetition, planned at course level (not an adaptive engine):
 * material comes back on its own day, about two days later, a week later
 * (and in that week's exam), and three weeks later — or two, early on.
 */
const RECENT_OFFSETS = [2, 7] as const;
const OLDER_OFFSETS = [21, 14] as const;
/** Older material gets two of a review's exercises when there is room for it. */
const OLDER_EXERCISES = 2;
/** A checkpoint's review warms up for the exam: mostly the week, a little of today. */
const CHECKPOINT_TODAY = 2;

/** Weekly exams grow with the course: 9 questions in week 1, 12 up to week 4, then 15. */
function examSize(week: number): Pick<CheckpointObjective, 'questions' | 'sections'> {
  if (week === 1) return { questions: 9, sections: { vocabulary: 4, grammar: 3, reading: 2 } };
  if (week <= 4) return { questions: 12, sections: { vocabulary: 5, grammar: 4, reading: 3 } };
  return { questions: 15, sections: { vocabulary: 6, grammar: 5, reading: 4 } };
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** Reading skills in their canonical order: main idea, detail, inference, context. */
const orderedSkills = (skills: readonly ReadingQuestionKind[]): ReadingQuestionKind[] =>
  ReadingQuestionKindSchema.options.filter((kind) => skills.includes(kind));

export function attachCurriculum(
  days: readonly CourseDay[],
  chapters: readonly Chapter[],
  bands: readonly BandProfile[],
  drafts: readonly DayDraft[],
): CourseDay[] {
  const draftOf = new Map(drafts.map((draft) => [draft.day, draft]));
  const kindOf = new Map(days.map((day) => [day.day, day.kind]));
  const bandOf = new Map(chapters.map((chapter) => [chapter.id, chapter.band]));
  const profileOf = new Map(bands.map((profile) => [profile.band, profile]));
  const checkpoints = days.filter((day) => day.kind === 'weeklyExam').map((day) => day.day);

  /** Earlier days a review can come back to: lesson days and checkpoints, never the summit. */
  const hasMaterial = (day: DayNumber, before: DayNumber) => {
    const kind = kindOf.get(day);
    return day >= 1 && day < before && kind !== undefined && kind !== 'summit';
  };

  const readingSkillsOf = (day: DayNumber): ReadingQuestionKind[] => {
    const draft = draftOf.get(day);
    const plan = days.find((item) => item.day === day);
    const band = plan ? bandOf.get(plan.chapterId) : undefined;
    const profile = band ? profileOf.get(band) : undefined;
    if (draft?.kind !== 'regular' || !profile) return [];
    return draft.reading.skills ?? profile.readingSkills;
  };

  function lessonReview(day: DayNumber, profile: BandProfile): ReviewPlan {
    const recentDays = RECENT_OFFSETS.map((offset) => day - offset).filter((d) =>
      hasMaterial(d, day),
    );
    // Day 2 has no day two before it: yesterday is its recent past.
    if (recentDays.length === 0 && hasMaterial(day - 1, day)) recentDays.push(day - 1);
    if (recentDays.length === 0) {
      return { today: profile.review.size, recent: 0, older: 0, recentDays: [], olderDays: [] };
    }
    const rest = profile.review.size - profile.review.today;
    const older = OLDER_OFFSETS.map((offset) => day - offset).find((d) => hasMaterial(d, day));
    const olderCount = older !== undefined && rest > OLDER_EXERCISES ? OLDER_EXERCISES : 0;
    return {
      today: profile.review.today,
      recent: rest - olderCount,
      older: olderCount,
      recentDays,
      olderDays: olderCount > 0 && older !== undefined ? [older] : [],
    };
  }

  function coveredDays(day: DayNumber): DayNumber[] {
    const previous = checkpoints.filter((checkpoint) => checkpoint < day).at(-1) ?? 0;
    return Array.from({ length: day - previous - 1 }, (_, index) => previous + 1 + index).filter(
      (covered) => hasMaterial(covered, day),
    );
  }

  function regular(draft: RegularDayDraft, profile: BandProfile, day: CourseDay): DayCurriculum {
    return {
      kind: 'regular',
      theme: draft.theme,
      vocabulary: draft.vocabulary,
      grammar: { ...draft.grammar, related: draft.grammar.related ?? [] },
      reading: {
        genre: draft.reading.genre,
        topic: draft.reading.topic,
        skills: orderedSkills(draft.reading.skills ?? profile.readingSkills),
        words: profile.readingWords,
        questions: profile.readingQuestions,
      },
      review: lessonReview(day.day, profile),
      ...(draft.revision ? { revision: { reason: draft.revision } } : {}),
    };
  }

  function checkpoint(
    draft: CheckpointDayDraft,
    profile: BandProfile,
    day: CourseDay,
  ): DayCurriculum {
    const covered = coveredDays(day.day);
    const lessons = covered
      .map((d) => draftOf.get(d))
      .filter((item): item is RegularDayDraft => item?.kind === 'regular');
    return {
      kind: 'weeklyExam',
      theme: draft.theme,
      vocabulary: draft.vocabulary,
      review: {
        today: CHECKPOINT_TODAY,
        recent: profile.review.size - CHECKPOINT_TODAY,
        older: 0,
        recentDays: covered,
        olderDays: [],
      },
      exam: {
        objective: draft.objective,
        coveredDays: covered,
        ...examSize(day.week),
        themes: unique(lessons.map((lesson) => lesson.theme.family)),
        grammar: unique(lessons.map((lesson) => lesson.grammar.topic)),
        readingSkills: orderedSkills(covered.flatMap(readingSkillsOf)),
        mustRetain: draft.mustRetain,
      },
      ...(draft.revision ? { revision: { reason: draft.revision } } : {}),
    };
  }

  return days.map((day) => {
    const draft = draftOf.get(day.day);
    const band = bandOf.get(day.chapterId);
    const profile = band ? profileOf.get(band) : undefined;
    if (!draft || !profile) return day;
    switch (draft.kind) {
      case 'regular':
        return { ...day, curriculum: regular(draft, profile, day) };
      case 'weeklyExam':
        return { ...day, curriculum: checkpoint(draft, profile, day) };
      case 'summit':
        return {
          ...day,
          curriculum: {
            kind: 'summit',
            theme: draft.theme,
            final: draft.final,
            ...(draft.revision ? { revision: { reason: draft.revision } } : {}),
          },
        };
    }
  });
}
