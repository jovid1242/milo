import { CHALLENGE } from '@/constants/challenge';
import type { Quest, QuestAnswerInput, QuestContent, ReviewQuest } from '@/schemas';

/**
 * How a daily quest is scored and paid — one definition for the app, which
 * shows the result at once, and for the server, which decides what counts.
 */

/** A scored choice exercise: its id, its options and the right one. */
export type ScorableExercise = {
  id: string;
  correctOptionId: string;
  optionIds: readonly string[];
};

/** The review's exercises its material can show — the ones the Review screen plays. */
function reviewExercises(review: ReviewQuest): ScorableExercise[] {
  const { material } = review;
  return review.exercises.flatMap((item): ScorableExercise[] => {
    switch (item.source) {
      case 'vocabulary': {
        const { exercise } = item;
        const ids = [exercise.itemId, ...exercise.optionItemIds];
        if (!ids.every((id) => material.words.some((word) => word.id === id))) return [];
        return [
          { id: exercise.id, correctOptionId: exercise.itemId, optionIds: exercise.optionItemIds },
        ];
      }
      case 'grammar': {
        if (!material.points.some((point) => point.id === item.pointId)) return [];
        const { exercise } = item;
        return [
          {
            id: exercise.id,
            correctOptionId: exercise.correctOptionId,
            optionIds: exercise.options.map((option) => option.id),
          },
        ];
      }
      case 'reading': {
        if (!material.readings.some((reading) => reading.id === item.readingId)) return [];
        const { question } = item;
        return [
          {
            id: question.id,
            correctOptionId: question.correctOptionId,
            optionIds: question.options.map((option) => option.id),
          },
        ];
      }
    }
  });
}

/**
 * The scored exercises of a daily quest, in the order they are played: the
 * vocabulary and grammar exercises, the reading questions, the review's
 * items. `null` for the exams, which are scored as a whole (`scoreExam`).
 */
export function scorableExercises(content: QuestContent): ScorableExercise[] | null {
  switch (content.type) {
    case 'vocabulary':
      return content.exercises.map((exercise) => ({
        id: exercise.id,
        correctOptionId: exercise.itemId,
        optionIds: exercise.optionItemIds,
      }));
    case 'grammar':
      return content.exercises.map((exercise) => ({
        id: exercise.id,
        correctOptionId: exercise.correctOptionId,
        optionIds: exercise.options.map((option) => option.id),
      }));
    case 'reading':
      return content.questions.map((question) => ({
        id: question.id,
        correctOptionId: question.correctOptionId,
        optionIds: question.options.map((option) => option.id),
      }));
    case 'review':
      return reviewExercises(content);
    case 'weeklyExam':
    case 'finalBattle':
      return null;
  }
}

export type QuestScore = {
  correctCount: number;
  totalCount: number;
  /** Share of right answers; 1 for a quest with nothing to answer. */
  score: number;
  isPerfect: boolean;
};

export function questScore(correctCount: number, totalCount: number): QuestScore {
  return {
    correctCount,
    totalCount,
    score: totalCount > 0 ? correctCount / totalCount : 1,
    isPerfect: totalCount > 0 && correctCount === totalCount,
  };
}

/**
 * Scores a finished quest's answers the way the quests collect them: every
 * exercise answered exactly once, with one of its own options (the first
 * answer counts — it cannot be changed). Anything else is not a played quest:
 * `null`.
 */
export function scoreQuestAnswers(
  exercises: readonly ScorableExercise[],
  answers: readonly QuestAnswerInput[],
): QuestScore | null {
  if (answers.length !== exercises.length) return null;
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const seen = new Set<string>();
  let correctCount = 0;
  for (const answer of answers) {
    const exercise = byId.get(answer.exerciseId);
    if (!exercise || seen.has(exercise.id) || !exercise.optionIds.includes(answer.optionId)) {
      return null;
    }
    seen.add(exercise.id);
    if (answer.optionId === exercise.correctOptionId) correctCount += 1;
  }
  return questScore(correctCount, exercises.length);
}

/**
 * What a quest pays on its first completion: its reward, and the
 * perfect-score bonus for no mistakes. A weekly exam pays through its own pass
 * reward instead (`exam.xpReward`, once, for the first pass).
 */
export function questReward(quest: Pick<Quest, 'type' | 'xpReward'>, isPerfect: boolean): number {
  if (quest.type === 'weeklyExam') return 0;
  return quest.xpReward + (isPerfect ? CHALLENGE.perfectScoreBonusXp : 0);
}
