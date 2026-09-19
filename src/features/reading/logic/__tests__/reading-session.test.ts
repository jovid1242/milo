import { DAY_089 } from '@/data/content/lessons/day-089';
import { scorePractice } from '@/features/quests/logic/practice';
import type { ReadingProgress, ReadingQuest } from '@/schemas';

import { describeReadingQuestion } from '../question-view';
import {
  INITIAL_READING,
  currentQuestion,
  hasReadingProgress,
  readingProgress,
  reduceReading,
  restoreReading,
  type ReadingAction,
} from '../reading-session';
import { splitParagraph } from '../story-text';

const quest = DAY_089.find((content) => content.type === 'reading') as ReadingQuest;
const AT = '2026-09-18T10:00:00.000Z';

const run = (actions: ReadingAction[], from: ReadingProgress = INITIAL_READING) =>
  actions.reduce((state, action) => reduceReading(quest, state, action), from);

const answer = (index: number, right: boolean): ReadingAction => {
  const question = quest.questions[index]!;
  const wrong = question.options.find((option) => option.id !== question.correctOptionId)!;
  return { type: 'answer', optionId: right ? question.correctOptionId : wrong.id, at: AT };
};

const read: ReadingAction[] = [{ type: 'start' }, { type: 'finishReading' }];
const answerAll = (wrongAt: number[] = []): ReadingAction[] =>
  quest.questions.flatMap((_, index): ReadingAction[] => [
    answer(index, !wrongAt.includes(index)),
    { type: 'continue' },
  ]);

describe('reading session', () => {
  it('reads the story first — at the reader’s pace, never scored', () => {
    const story = run([{ type: 'start' }]);
    expect(story.phase).toBe('story');
    expect(hasReadingProgress(quest, story)).toBe(false);

    const halfway = run([{ type: 'readTo', paragraphIndex: 3 }], story);
    expect(halfway.paragraphIndex).toBe(3);
    expect(hasReadingProgress(quest, halfway)).toBe(true);
    // Out-of-range positions are clamped to the story.
    expect(run([{ type: 'readTo', paragraphIndex: 99 }], story).paragraphIndex).toBe(
      quest.story.paragraphs.length - 1,
    );

    const atEnd = run([{ type: 'reachEnd' }], halfway);
    expect(atEnd.reachedEnd).toBe(true);
    expect(readingProgress(quest, atEnd)).toBeCloseTo(1 / 5);

    const questions = run([{ type: 'finishReading' }], atEnd);
    expect(questions).toMatchObject({ phase: 'questions', practiceIndex: 0, answers: [] });
  });

  it('remembers opened words without making them a task', () => {
    const story = run([{ type: 'start' }]);
    const opened = run(
      [
        { type: 'openWord', wordId: 'gradually' },
        { type: 'openWord', wordId: 'gradually' },
        { type: 'openWord', wordId: 'not-in-the-story' },
      ],
      story,
    );
    expect(opened.openedWordIds).toEqual(['gradually']);
    // Finishing does not depend on looking words up.
    expect(run([{ type: 'finishReading' }], story).phase).toBe('questions');
  });

  it('checks each answer against its question and locks the first one', () => {
    const questions = run(read);
    const question = currentQuestion(quest, questions)!;

    const right = run([answer(0, true)], questions);
    expect(right.answers[0]).toMatchObject({ exerciseId: question.id, correct: true });

    const wrong = run([answer(0, false)], questions);
    expect(wrong.answers[0]?.correct).toBe(false);
    expect(run([answer(0, true)], wrong)).toBe(wrong);
    expect(run([{ type: 'continue' }], questions)).toBe(questions);
  });

  it('shows the evidence only as feedback, and asks at most one word question', () => {
    for (const question of quest.questions) {
      const view = describeReadingQuestion(question);
      expect(view.feedback).toEqual({ correct: question.evidence, wrong: question.evidence });
      expect(view.options.map((option) => option.label).join(' ')).not.toContain(question.evidence);
    }
    const kinds = quest.questions.map((question) => question.kind);
    expect(kinds).toEqual(['mainIdea', 'detail', 'inference', 'context']);
  });

  it('ends with a result; perfect only when every answer is right', () => {
    const threeOfFour = run([...read, ...answerAll([2])]);
    expect(threeOfFour.phase).toBe('result');
    expect(scorePractice(threeOfFour.answers, 4)).toEqual({
      correctCount: 3,
      total: 4,
      isPerfect: false,
    });
    expect(scorePractice(run([...read, ...answerAll()]).answers, 4).isPerfect).toBe(true);
  });

  it('restores the reading position or the current question', () => {
    const halfway = run([{ type: 'start' }, { type: 'readTo', paragraphIndex: 2 }]);
    const atQuestion3 = run([
      ...read,
      answer(0, true),
      { type: 'continue' },
      answer(1, false),
      { type: 'continue' },
    ]);
    for (const saved of [halfway, atQuestion3]) {
      expect(restoreReading(quest, JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    }
    expect(atQuestion3.practiceIndex).toBe(2);

    expect(restoreReading(quest, undefined)).toBe(INITIAL_READING);
    expect(restoreReading(quest, { ...halfway, paragraphIndex: 40 })).toBe(INITIAL_READING);
    expect(restoreReading(quest, { ...halfway, openedWordIds: ['nope'] })).toBe(INITIAL_READING);
    expect(restoreReading(quest, { ...halfway, answers: atQuestion3.answers })).toBe(
      INITIAL_READING,
    );
  });

  it('picks out story words as whole words, in reading order', () => {
    const paragraph = quest.story.paragraphs.find((item) => item.id === 'p3')!;
    const marked = splitParagraph(paragraph, quest.story.words).filter((part) => part.wordId);
    expect(marked).toEqual([
      { text: 'give up', wordId: 'give-up' },
      { text: 'patient', wordId: 'patient' },
    ]);
    expect(
      splitParagraph({ id: 'x', text: 'Start the art class.' }, [
        { id: 'art', text: 'art', paragraphId: 'x', translation: 'искусство', definition: 'art' },
      ]),
    ).toEqual([
      { text: 'Start the ', wordId: null },
      { text: 'art', wordId: 'art' },
      { text: ' class.', wordId: null },
    ]);
  });
});
