import {
  DisplayNameSchema,
  ONBOARDING_STEPS,
  type Goal,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/schemas';
import { clamp } from '@/utils/number';

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export type GoalOption = {
  goal: Goal;
  label: string;
  hint: string;
};

/** Reasons people actually start; one is chosen, none is wrong. */
export const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    goal: 'confidence',
    label: 'Speak with confidence',
    hint: 'Say what I mean without freezing',
  },
  {
    goal: 'understanding',
    label: 'Understand what I hear',
    hint: 'Films, calls, people talking fast',
  },
  {
    goal: 'vocabulary',
    label: 'Know more words',
    hint: 'A vocabulary I actually use',
  },
  {
    goal: 'habit',
    label: 'Build a daily habit',
    hint: 'Show up every day for 90 days',
  },
  {
    goal: 'workStudy',
    label: 'English for work or study',
    hint: 'Meetings, emails, exams',
  },
];

/** 1-based position, as shown to the user ("Step 3 of 5"). */
export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

/** The step at a 1-based position, clamped — used by dev tools and restored drafts. */
export function stepAt(position: number): OnboardingStep {
  const index = clamp(Math.round(position), 1, TOTAL_STEPS) - 1;
  return ONBOARDING_STEPS[index] ?? 'welcome';
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index < TOTAL_STEPS - 1 ? (ONBOARDING_STEPS[index + 1] ?? null) : null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null;
}

/** Whether the step's own answer is given — the only thing that gates Continue. */
export function canContinue(draft: OnboardingDraft): boolean {
  if (draft.step === 'goal') return draft.goal !== null;
  if (draft.step === 'name') return DisplayNameSchema.safeParse(draft.name).success;
  return true;
}

/**
 * The name's problem, once there is something to complain about: an empty
 * field is simply not ready yet, not an error to shout about while typing.
 */
export function nameError(name: string): string | null {
  if (name.trim().length === 0) return null;
  const parsed = DisplayNameSchema.safeParse(name);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'That name will not work');
}

/** The label of the button that leaves the step. */
export function continueLabel(step: OnboardingStep): string {
  return step === 'name' ? 'Start Day 1' : 'Continue';
}
