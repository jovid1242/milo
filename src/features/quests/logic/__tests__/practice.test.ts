import {
  answersFit,
  nextPracticeStep,
  scorePractice,
  toAnswerRecords,
  withAnswer,
  type ChoiceExercise,
  type PracticeState,
} from '../practice';

const AT = '2026-09-18T10:00:00.000Z';
const EXERCISES: ChoiceExercise[] = [
  { id: 'q1', correctOptionId: 'b', optionIds: ['a', 'b'] },
  { id: 'q2', correctOptionId: 'c', optionIds: ['a', 'b', 'c'] },
];
const START: PracticeState = { practiceIndex: 0, answers: [] };

describe('shared practice logic', () => {
  it('scores an answer and locks it in', () => {
    const wrong = withAnswer(START, EXERCISES[0]!, 'a', AT);
    expect(wrong.answers).toEqual([
      { exerciseId: 'q1', optionId: 'a', correct: false, answeredAt: AT },
    ]);

    // The first answer is final: the right option afterwards changes nothing.
    expect(withAnswer(wrong, EXERCISES[0]!, 'b', AT)).toBe(wrong);
    // Unknown options are ignored.
    expect(withAnswer(START, EXERCISES[0]!, 'z', AT)).toBe(START);
  });

  it('continues only from an answered exercise, then finishes', () => {
    expect(nextPracticeStep(START, EXERCISES[0]!, 2)).toBeNull();

    const first = withAnswer(START, EXERCISES[0]!, 'b', AT);
    expect(nextPracticeStep(first, EXERCISES[0]!, 2)).toBe(1);

    const second = withAnswer({ ...first, practiceIndex: 1 }, EXERCISES[1]!, 'c', AT);
    expect(nextPracticeStep(second, EXERCISES[1]!, 2)).toBe('done');
  });

  it('detects a perfect run', () => {
    const right = withAnswer(withAnswer(START, EXERCISES[0]!, 'b', AT), EXERCISES[1]!, 'c', AT);
    expect(scorePractice(right.answers, 2)).toEqual({ correctCount: 2, total: 2, isPerfect: true });

    const oneMiss = withAnswer(withAnswer(START, EXERCISES[0]!, 'a', AT), EXERCISES[1]!, 'c', AT);
    expect(scorePractice(oneMiss.answers, 2)).toEqual({
      correctCount: 1,
      total: 2,
      isPerfect: false,
    });
    expect(scorePractice([], 0).isPerfect).toBe(false);
  });

  it('stores answers in the shared answer format', () => {
    const answered = withAnswer(START, EXERCISES[0]!, 'b', AT);
    expect(toAnswerRecords('quest-1', answered.answers)).toEqual([
      {
        questId: 'quest-1',
        questionId: 'q1',
        answer: { kind: 'singleChoice', optionId: 'b' },
        isCorrect: true,
        answeredAt: AT,
      },
    ]);
  });

  it('rejects saved answers that no longer fit the content', () => {
    const answered = withAnswer(START, EXERCISES[0]!, 'b', AT).answers;
    expect(answersFit(answered, EXERCISES, 0)).toBe(true);
    expect(answersFit(answered, EXERCISES, 5)).toBe(false);
    expect(answersFit([{ ...answered[0]!, correct: false }], EXERCISES, 0)).toBe(false);
    expect(answersFit([{ ...answered[0]!, exerciseId: 'gone' }], EXERCISES, 0)).toBe(false);
    expect(answersFit([...answered, ...answered], EXERCISES, 1)).toBe(false);
  });
});
