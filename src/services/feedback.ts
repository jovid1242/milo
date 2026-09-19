import { playSound, type SoundName } from './audio/sound-manager';
import { triggerHaptic, type HapticPattern } from './haptics/haptics';

/**
 * Semantic feedback events: one place that decides which sound and which haptic
 * belongs to a moment in the app.
 *
 * Rules of thumb:
 * - no sound on ordinary taps; `importantAction` (tap-soft) is for deliberate,
 *   meaningful actions only;
 * - answer selection is haptics-only.
 */
export type FeedbackEvent =
  | 'importantAction'
  | 'answerSelect'
  | 'correct'
  | 'wrong'
  | 'questComplete'
  | 'dayComplete'
  | 'perfect'
  | 'streakUp'
  | 'streakStep'
  | 'streakLost'
  | 'levelUp'
  | 'achievementUnlock'
  | 'weeklyExamStart'
  | 'weeklyExamPass'
  | 'finalBattle'
  | 'summitVictory'
  | 'friendJoined';

const FEEDBACK: Record<FeedbackEvent, { sound?: SoundName; haptic?: HapticPattern }> = {
  importantAction: { sound: 'tapSoft', haptic: 'press' },
  answerSelect: { haptic: 'answerSelect' },
  correct: { sound: 'correct', haptic: 'correct' },
  wrong: { sound: 'wrong', haptic: 'wrong' },
  questComplete: { sound: 'questComplete', haptic: 'questComplete' },
  dayComplete: { sound: 'dayComplete', haptic: 'dayComplete' },
  perfect: { sound: 'perfect', haptic: 'achievementUnlock' },
  streakUp: { sound: 'streakUp', haptic: 'streakUp' },
  // The streak growing inside a bigger moment (Day Complete): felt, not heard —
  // the day's own sound is still playing.
  streakStep: { haptic: 'streakUp' },
  streakLost: { sound: 'streakLost', haptic: 'press' },
  levelUp: { sound: 'levelUp', haptic: 'achievementUnlock' },
  achievementUnlock: { sound: 'achievementUnlock', haptic: 'achievementUnlock' },
  weeklyExamStart: { sound: 'weeklyExamStart', haptic: 'press' },
  weeklyExamPass: { sound: 'weeklyExamPass', haptic: 'dayComplete' },
  finalBattle: { sound: 'finalBattle', haptic: 'press' },
  summitVictory: { sound: 'summitVictory', haptic: 'finalVictory' },
  friendJoined: { sound: 'friendJoined', haptic: 'selection' },
};

export function playFeedback(event: FeedbackEvent): void {
  const { sound, haptic } = FEEDBACK[event];
  if (sound) playSound(sound);
  if (haptic) triggerHaptic(haptic);
}

export const FEEDBACK_EVENTS = Object.keys(FEEDBACK) as FeedbackEvent[];
