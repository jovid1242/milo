import { DAY_089 } from '@/data/content/lessons/day-089';
import { scorePractice } from '@/features/quests/logic/practice';
import type { GrammarProgress, GrammarQuest } from '@/schemas';

import { describeGrammarExercise } from '../exercise-view';
import {
  INITIAL_GRAMMAR,
  currentExercise,
  grammarProgress,
  grammarStepsDone,
  hasGrammarProgress,
  reduceGrammar,
  restoreGrammar,
  type GrammarAction,
} from '../grammar-session';
import { splitMarks } from '../marked-sentence';

const quest = DAY_089.find((content) => content.type === 'grammar') as GrammarQuest;
const AT = '2026-09-18T10:00:00.000Z';

const run = (actions: GrammarAction[], from: GrammarProgress = INITIAL_GRAMMAR) =>
  actions.reduce((state, action) => reduceGrammar(quest, state, action), from);

const learn: GrammarAction[] = [
  { type: 'start' },
  { type: 'ruleLearned' },
  ...quest.examples.flatMap((): GrammarAction[] => [
    { type: 'revealExample' },
    { type: 'nextExample' },
  ]),
];

const answer = (index: number, right: boolean): GrammarAction => {
  const exercise = quest.exercises[index]!;
  const wrong = exercise.options.find((option) => option.id !== exercise.correctOptionId)!;
  return { type: 'answer', optionId: right ? exercise.correctOptionId : wrong.id, at: AT };
};

const answerFirst = (count: number, wrongAt: number[] = []): GrammarAction[] =>
  quest.exercises
    .slice(0, count)
    .flatMap((_, index): GrammarAction[] => [
      answer(index, !wrongAt.includes(index)),
      { type: 'continue' },
    ]);

describe('grammar session', () => {
  it('walks intro → rule → guided examples → practice', () => {
    const rule = run([{ type: 'start' }]);
    expect(rule.phase).toBe('rule');
    expect(hasGrammarProgress(quest, rule)).toBe(false);

    const example = run([{ type: 'ruleLearned' }], rule);
    expect(example).toMatchObject({ phase: 'examples', exampleIndex: 0, exampleRevealed: false });
    expect(grammarStepsDone(quest, example)).toBe(1);

    // "Next" does nothing until the example was explained: no skipping on a double tap.
    expect(run([{ type: 'nextExample' }], example)).toBe(example);
    const explained = run([{ type: 'revealExample' }], example);
    expect(grammarStepsDone(quest, explained)).toBe(2);
    expect(run([{ type: 'nextExample' }, { type: 'nextExample' }], explained).exampleIndex).toBe(1);

    const practice = run(learn);
    expect(practice.phase).toBe('practice');
    // Learning is the rule and 3 examples: 4 of 10 steps, nothing scored yet.
    expect(grammarProgress(quest, practice)).toBeCloseTo(0.4);
    expect(practice.answers).toEqual([]);
  });

  it('checks each answer against its exercise and locks the first one', () => {
    const practice = run(learn);
    const exercise = currentExercise(quest, practice)!;

    const right = run([answer(0, true)], practice);
    expect(right.answers[0]).toMatchObject({ exerciseId: exercise.id, correct: true });

    const wrong = run([answer(0, false)], practice);
    expect(wrong.answers[0]).toMatchObject({ exerciseId: exercise.id, correct: false });
    expect(run([answer(0, true)], wrong)).toBe(wrong);

    // Continue only moves on from an answered exercise.
    expect(run([{ type: 'continue' }], practice)).toBe(practice);
    expect(run([{ type: 'continue' }], wrong).practiceIndex).toBe(1);
  });

  it('ends with a result; perfect only when every answer is right', () => {
    const fiveOfSix = run([...learn, ...answerFirst(6, [1])]);
    expect(fiveOfSix.phase).toBe('result');
    expect(scorePractice(fiveOfSix.answers, 6)).toEqual({
      correctCount: 5,
      total: 6,
      isPerfect: false,
    });

    const perfect = run([...learn, ...answerFirst(6)]);
    expect(scorePractice(perfect.answers, 6).isPerfect).toBe(true);
    expect(grammarProgress(quest, perfect)).toBe(1);
  });

  it('explains every exercise with its own explanation', () => {
    for (const exercise of quest.exercises) {
      const view = describeGrammarExercise(exercise);
      const correct = exercise.options.find((option) => option.id === exercise.correctOptionId);
      expect(view.answerLabel).toBe(correct?.text);
      expect(view.feedback.correct).toBe(exercise.explanation);
      expect(view.feedback.wrong).toContain(exercise.explanation);
      if (view.gap) expect(view.feedback.wrong).toContain(`“${correct?.text}”`);
    }
    // Exercises differ: sentence gaps and whole-sentence questions.
    const kinds = new Set(quest.exercises.map((exercise) => exercise.kind));
    expect([...kinds].sort()).toEqual(['choose', 'complete', 'meaning', 'spotCorrect']);
  });

  it('restores saved progress; starts over when it does not fit', () => {
    const atExample = run([{ type: 'start' }, { type: 'ruleLearned' }, { type: 'revealExample' }]);
    const atExercise3 = run([...learn, ...answerFirst(2)]);
    for (const saved of [atExample, atExercise3]) {
      expect(restoreGrammar(quest, JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    }
    expect(atExercise3.practiceIndex).toBe(2);

    expect(restoreGrammar(quest, null)).toBe(INITIAL_GRAMMAR);
    expect(restoreGrammar(quest, { phase: 'rule' })).toBe(INITIAL_GRAMMAR);
    expect(restoreGrammar(quest, { ...atExample, exampleIndex: 9 })).toBe(INITIAL_GRAMMAR);
    expect(
      restoreGrammar(quest, {
        ...atExercise3,
        answers: atExercise3.answers.map((a) => ({ ...a, correct: !a.correct })),
      }),
    ).toBe(INITIAL_GRAMMAR);
    expect(restoreGrammar(quest, { ...atExample, answers: atExercise3.answers })).toBe(
      INITIAL_GRAMMAR,
    );
  });

  it('splits marked sentences in reading order', () => {
    expect(
      splitMarks({
        text: 'Have you ever been to Italy?',
        marks: [
          { text: 'Have', kind: 'form' },
          { text: 'ever', kind: 'signal' },
          { text: 'been', kind: 'form' },
        ],
      }),
    ).toEqual([
      { text: 'Have', kind: 'form' },
      { text: ' you ', kind: 'plain' },
      { text: 'ever', kind: 'signal' },
      { text: ' ', kind: 'plain' },
      { text: 'been', kind: 'form' },
      { text: ' to Italy?', kind: 'plain' },
    ]);
  });
});
