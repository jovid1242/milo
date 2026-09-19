import { DAY_089 } from '@/data/content/lessons/day-089';
import { scorePractice } from '@/features/quests/logic/practice';
import type { VocabularyProgress, VocabularyQuest } from '@/schemas';

import {
  INITIAL_PROGRESS,
  currentExercise,
  hasProgress,
  progressFraction,
  reduceVocabulary,
  restoreProgress,
  type VocabularyAction,
} from '../vocabulary-session';

const quest = DAY_089.find((content) => content.type === 'vocabulary') as VocabularyQuest;
const AT = '2026-09-18T10:00:00.000Z';

const run = (actions: VocabularyAction[], from: VocabularyProgress = INITIAL_PROGRESS) =>
  actions.reduce((state, action) => reduceVocabulary(quest, state, action), from);

const learnAll: VocabularyAction[] = [
  { type: 'start' },
  ...quest.items.flatMap((): VocabularyAction[] => [{ type: 'reveal' }, { type: 'learned' }]),
];

/** Answers every exercise; `wrongAt` lists exercise indexes answered wrongly. */
const answerAll = (wrongAt: number[] = []): VocabularyAction[] =>
  quest.exercises.flatMap((exercise, index): VocabularyAction[] => {
    const wrong = exercise.optionItemIds.find((id) => id !== exercise.itemId) ?? exercise.itemId;
    return [
      { type: 'answer', optionId: wrongAt.includes(index) ? wrong : exercise.itemId, at: AT },
      { type: 'continue' },
    ];
  });

describe('vocabulary session', () => {
  it('meets every word before practice starts', () => {
    const learning = run([{ type: 'start' }]);
    expect(learning.phase).toBe('learn');
    expect(hasProgress(learning)).toBe(false);

    const revealed = run([{ type: 'reveal' }], learning);
    expect(revealed.revealed).toBe(true);
    expect(hasProgress(revealed)).toBe(true);

    const practice = run(learnAll);
    expect(practice.phase).toBe('practice');
    expect(practice.learnedItemIds).toEqual(quest.items.map((item) => item.id));
    expect(progressFraction(quest, practice)).toBe(0.5);
  });

  it('does not skip a word on a double tap of "Got it"', () => {
    const learning = run([{ type: 'start' }, { type: 'reveal' }]);
    const next = run([{ type: 'learned' }, { type: 'learned' }], learning);
    expect(next.learnIndex).toBe(1);
    expect(next.learnedItemIds).toHaveLength(1);
  });

  it('scores a correct and a wrong answer against the item', () => {
    const practice = run(learnAll);
    const exercise = currentExercise(quest, practice);
    if (!exercise) throw new Error('no exercise');

    const right = run([{ type: 'answer', optionId: exercise.itemId, at: AT }], practice);
    expect(right.answers[0]?.correct).toBe(true);

    const wrongId = exercise.optionItemIds.find((id) => id !== exercise.itemId) ?? '';
    const wrong = run([{ type: 'answer', optionId: wrongId, at: AT }], practice);
    expect(wrong.answers[0]?.correct).toBe(false);
  });

  it('ends with a result; perfect only when every answer is right', () => {
    const fiveOfSix = run([...learnAll, ...answerAll([3])]);
    expect(fiveOfSix.phase).toBe('result');
    expect(scorePractice(fiveOfSix.answers, quest.exercises.length)).toEqual({
      correctCount: 5,
      total: 6,
      isPerfect: false,
    });

    const perfect = run([...learnAll, ...answerAll()]);
    expect(scorePractice(perfect.answers, quest.exercises.length).isPerfect).toBe(true);
    expect(progressFraction(quest, perfect)).toBe(1);
  });

  it('restores saved progress and starts over when it does not fit', () => {
    const midway = run([...learnAll, ...answerAll().slice(0, 4)]);
    expect(restoreProgress(quest, JSON.parse(JSON.stringify(midway)))).toEqual(midway);

    expect(restoreProgress(quest, null)).toBe(INITIAL_PROGRESS);
    expect(restoreProgress(quest, { phase: 'learn' })).toBe(INITIAL_PROGRESS);
    expect(restoreProgress(quest, { ...midway, learnIndex: 99 })).toBe(INITIAL_PROGRESS);
    expect(
      restoreProgress(quest, {
        ...midway,
        answers: [{ exerciseId: 'gone', optionId: 'x', correct: true, answeredAt: AT }],
      }),
    ).toBe(INITIAL_PROGRESS);
  });
});
