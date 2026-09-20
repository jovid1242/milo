import { z } from 'zod';

import { GoalSchema } from './user';

/**
 * First launch, step by step: who Milo is, where the 90 days lead, what a day
 * looks like, what the user wants from it, and what to call them.
 */
export const OnboardingStepSchema = z.enum(['welcome', 'journey', 'day', 'goal', 'name']);
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const ONBOARDING_STEPS = OnboardingStepSchema.options;

/**
 * What onboarding has collected so far. It is kept on the device between
 * launches: closing the app halfway through must never throw the answers away.
 */
export const OnboardingDraftSchema = z.object({
  step: OnboardingStepSchema,
  /** Raw text while typing; checked against `DisplayNameSchema` on submit. */
  name: z.string().max(24),
  goal: GoalSchema.nullable(),
});
export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;

export const EMPTY_DRAFT: OnboardingDraft = { step: 'welcome', name: '', goal: null };

/**
 * A stored draft is untrusted input (an old version, a partial write): every
 * field is checked on its own and anything unusable falls back to empty, so a
 * bad value can never block the first launch.
 */
export function parseOnboardingDraft(stored: unknown): OnboardingDraft {
  const source = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const field = <K extends keyof OnboardingDraft>(key: K): OnboardingDraft[K] => {
    const parsed = OnboardingDraftSchema.shape[key].safeParse(source[key]);
    return parsed.success ? (parsed.data as OnboardingDraft[K]) : EMPTY_DRAFT[key];
  };
  return { step: field('step'), name: field('name'), goal: field('goal') };
}
