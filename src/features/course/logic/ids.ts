import type { DayNumber, QuestType } from '@/schemas';

/**
 * The course's id convention — one scheme for everything, never derived from
 * translated text, never changed once published (progress points at ids).
 *
 *   course            milo-english-90
 *   chapter           beginning · momentum · habit · growth · summit   (the art keys)
 *   day               d001 … d090
 *   quest             d001-vocabulary · d001-grammar · d007-weeklyExam · d090-finalBattle
 *   word              vocab-<lemma>[-<sense>]        vocab-journey, vocab-present-gift
 *   grammar lesson    grammar-<topic>                grammar-present-simple-habits
 *   grammar point     <lesson id>.<point>            grammar-present-simple-habits.base
 *   reading text      reading-<slug>                 reading-small-steps
 *   weekly exam       exam-week-NN                   exam-week-01 … exam-week-12
 *   final challenge   final-challenge
 *   exercise          <day id>-<quest>-<n>           d001-vocab-1, d001-reading-q2, d002-review-4
 *   exam question     <exam short>-<section><n>      w01-v1, w12-g3, fb-r2
 *
 * Course-wide ids are unique across the whole course. Option (`a`…`d`),
 * paragraph (`p1`…) and highlighted-word ids are scoped to their question or
 * text and only unique there.
 */

export const dayId = (day: DayNumber): string => `d${String(day).padStart(3, '0')}`;

export const questId = (day: DayNumber, type: QuestType): string => `${dayId(day)}-${type}`;

export const weeklyExamId = (week: number): string => `exam-week-${String(week).padStart(2, '0')}`;

export const FINAL_CHALLENGE_ID = 'final-challenge';

/** The day a quest id belongs to, or `null` for an id that is not one. */
export function dayOfQuestId(id: string): number | null {
  const match = /^d(\d{3})-/.exec(id);
  return match ? Number(match[1]) : null;
}
