import { playFeedback } from '@/services/feedback';

import type { QuestOutcome } from './use-cases';

/**
 * The single sound/haptic that fires when a quest ends. Full reward scenes
 * (confetti, badge reveal, level-up) come with the reward screens; this keeps
 * the moment meaningful instead of stacking every effect at once.
 */
export function playQuestOutcomeFeedback(outcome: QuestOutcome): void {
  if (outcome.isSummit) return playFeedback('summitVictory');
  if (outcome.dayCompleted) return playFeedback('dayComplete');
  if (outcome.examPassed === true) return playFeedback('weeklyExamPass');
  if (outcome.isPerfect) return playFeedback('perfect');
  playFeedback('questComplete');
}
