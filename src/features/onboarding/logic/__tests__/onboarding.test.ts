import { EMPTY_DRAFT, ONBOARDING_STEPS, parseOnboardingDraft } from '@/schemas';

import {
  GOAL_OPTIONS,
  TOTAL_STEPS,
  canContinue,
  continueLabel,
  nameError,
  nextStep,
  previousStep,
  stepAt,
  stepNumber,
} from '../onboarding';

describe('onboarding steps', () => {
  it('runs from the welcome to the name, and no further', () => {
    expect(ONBOARDING_STEPS[0]).toBe('welcome');
    expect(previousStep('welcome')).toBeNull();
    expect(nextStep('name')).toBeNull();

    const visited = [ONBOARDING_STEPS[0]];
    let step = nextStep('welcome');
    while (step) {
      visited.push(step);
      step = nextStep(step);
    }
    expect(visited).toEqual([...ONBOARDING_STEPS]);
    expect(stepNumber('name')).toBe(TOTAL_STEPS);
  });

  it('walks back the way it came', () => {
    for (const step of ONBOARDING_STEPS.slice(1)) {
      const previous = previousStep(step);
      expect(previous).not.toBeNull();
      expect(previous && nextStep(previous)).toBe(step);
    }
  });

  it('clamps a step asked for by number', () => {
    expect(stepAt(1)).toBe('welcome');
    expect(stepAt(TOTAL_STEPS)).toBe('name');
    expect(stepAt(0)).toBe('welcome');
    expect(stepAt(99)).toBe('name');
    expect(stepAt(Number.NaN)).toBe('welcome');
  });

  it('only gates the steps that ask something', () => {
    const draft = { ...EMPTY_DRAFT };
    expect(canContinue({ ...draft, step: 'welcome' })).toBe(true);
    expect(canContinue({ ...draft, step: 'journey' })).toBe(true);
    expect(canContinue({ ...draft, step: 'day' })).toBe(true);

    expect(canContinue({ ...draft, step: 'goal' })).toBe(false);
    expect(canContinue({ ...draft, step: 'goal', goal: 'habit' })).toBe(true);

    expect(canContinue({ ...draft, step: 'name', goal: 'habit' })).toBe(false);
    expect(canContinue({ ...draft, step: 'name', goal: 'habit', name: 'A' })).toBe(false);
    expect(canContinue({ ...draft, step: 'name', goal: 'habit', name: 'Jo' })).toBe(true);
  });

  it('complains about a name only once there is one', () => {
    expect(nameError('')).toBeNull();
    expect(nameError('   ')).toBeNull();
    expect(nameError('Jo')).toBeNull();
    expect(nameError('J')).not.toBeNull();
    expect(nameError('<script>')).not.toBeNull();
  });

  it('names the last button after what it does', () => {
    expect(continueLabel('welcome')).toBe('Continue');
    expect(continueLabel('name')).toBe('Start Day 1');
  });

  it('offers one goal per stored value, all distinct', () => {
    const goals = GOAL_OPTIONS.map((option) => option.goal);
    expect(new Set(goals).size).toBe(goals.length);
    expect(goals.length).toBeGreaterThanOrEqual(4);
  });
});

describe('the stored draft', () => {
  it('keeps what a half-finished onboarding collected', () => {
    const draft = { step: 'name' as const, name: 'Mira', goal: 'habit' as const };
    expect(parseOnboardingDraft(draft)).toEqual(draft);
  });

  it('survives anything that is not a draft', () => {
    expect(parseOnboardingDraft(null)).toEqual(EMPTY_DRAFT);
    expect(parseOnboardingDraft('nonsense')).toEqual(EMPTY_DRAFT);
    expect(parseOnboardingDraft({ step: 'fourth', name: 42, goal: 'fluency' })).toEqual(
      EMPTY_DRAFT,
    );
  });

  it('drops only the field that is broken', () => {
    expect(parseOnboardingDraft({ step: 'goal', name: 'Mira', goal: 'whatever' })).toEqual({
      step: 'goal',
      name: 'Mira',
      goal: null,
    });
  });
});
