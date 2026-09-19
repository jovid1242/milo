import { QUEST_CONTENT } from '@/data/content/lessons';
import { questId } from '@/data/content/schedule';
import type { QuestContent, ReviewProgress, ReviewQuest } from '@/schemas';

import { resolveReview, reviewMaterial, type ReviewItem } from '../review-items';
import {
  INITIAL_REVIEW,
  currentItem,
  hasReviewProgress,
  reduceReview,
  restoreReview,
  reviewProgress,
  reviewStage,
  reviewStepsDone,
  scoreReview,
  type ReviewAction,
} from '../review-session';

const AT = '2026-09-18T10:00:00.000Z';
const CONTENTS = [...QUEST_CONTENT.values()];

function review(day: number): ReviewQuest {
  const content = QUEST_CONTENT.get(questId(day, 'review'));
  if (content?.type !== 'review') throw new Error(`no review for day ${day}`);
  return content;
}

function itemsFor(day: number, contents: readonly QuestContent[] = CONTENTS): ReviewItem[] {
  const quest = review(day);
  return resolveReview(quest, reviewMaterial(quest, contents));
}

const ITEMS = itemsFor(89);

const play = (actions: ReviewAction[], from: ReviewProgress = INITIAL_REVIEW) =>
  actions.reduce((state, action) => reduceReview(ITEMS, state, action), from);

/** Answers every item, wrong at the given indexes. */
function answerAll(wrongAt: readonly number[] = []): ReviewAction[] {
  return ITEMS.flatMap((item, index): ReviewAction[] => {
    const wrong = item.choice.optionIds.find((id) => id !== item.choice.correctOptionId) ?? '';
    return [
      {
        type: 'answer',
        optionId: wrongAt.includes(index) ? wrong : item.choice.correctOptionId,
        at: AT,
      },
      { type: 'continue' },
    ];
  });
}

describe('review content', () => {
  it('mixes Day 89 into 8 exercises from all three quests: V G R V G V R G', () => {
    expect(ITEMS).toHaveLength(8);
    expect(ITEMS.map((item) => item.source[0]?.toUpperCase()).join(' ')).toBe('V G R V G V R G');
  });

  it('resolves every reference against the day it reviews — nothing is dropped', () => {
    for (const day of [1, 89]) {
      expect(itemsFor(day)).toHaveLength(review(day).exercises.length);
    }
  });

  it('points at today’s quests instead of copying them', () => {
    for (const day of [1, 89]) {
      const quest = review(day);
      expect(quest.sources).toEqual({
        vocabulary: questId(day, 'vocabulary'),
        grammar: questId(day, 'grammar'),
        reading: questId(day, 'reading'),
      });
    }
    // The words come from the Vocabulary quest…
    const vocabulary = ITEMS.find((item) => item.source === 'vocabulary');
    expect(vocabulary?.source === 'vocabulary' && vocabulary.view.prompt?.text).toBe('consistent');
    // …and the story line is quoted from the Reading quest by reference.
    const quoted = ITEMS.find((item) => item.source === 'reading' && item.snippet);
    expect(quoted?.source === 'reading' && quoted.snippet).toBe(
      'The father thanked her and said that her English was very clear.',
    );
  });

  it('leaves out exercises whose material is missing, without crashing', () => {
    const withoutVocabulary = CONTENTS.filter((content) => content.type !== 'vocabulary');
    const items = itemsFor(89, withoutVocabulary);
    expect(items).toHaveLength(5);
    expect(items.some((item) => item.source === 'vocabulary')).toBe(false);
  });
});

describe('review session', () => {
  it('runs intro → practice → result', () => {
    expect(reviewStage(INITIAL_REVIEW)).toBe('intro');
    const started = play([{ type: 'start' }]);
    expect(started.phase).toBe('practice');
    expect(currentItem(ITEMS, started)?.id).toBe('d089-review-1');

    const done = play([{ type: 'start' }, ...answerAll()]);
    expect(done.phase).toBe('result');
    expect(reviewStage(done)).toBe('result');
    expect(reviewStepsDone(ITEMS, done)).toBe(8);
    expect(reviewProgress(ITEMS, done)).toBe(1);
  });

  it('locks the first answer and never skips an unanswered question', () => {
    const started = play([{ type: 'start' }]);
    expect(play([{ type: 'continue' }], started)).toBe(started);

    const answered = play(answerAll([0]).slice(0, 1), started);
    const again = play(
      [{ type: 'answer', optionId: ITEMS[0]?.choice.correctOptionId ?? '', at: AT }],
      answered,
    );
    expect(again.answers).toEqual(answered.answers);
    expect(again.answers[0]?.correct).toBe(false);
    expect(hasReviewProgress(answered)).toBe(true);
  });

  it('counts wrong answers but lets the review finish', () => {
    const done = play([{ type: 'start' }, ...answerAll([3])]);
    expect(done.phase).toBe('result');
    const result = scoreReview(ITEMS, done.answers);
    expect(result).toMatchObject({ correctCount: 7, total: 8, isPerfect: false });
    expect(result.bySource).toEqual({
      vocabulary: { correct: 2, total: 3 },
      grammar: { correct: 3, total: 3 },
      reading: { correct: 2, total: 2 },
    });
    expect(scoreReview(ITEMS, play([{ type: 'start' }, ...answerAll()]).answers).isPerfect).toBe(
      true,
    );
  });

  it('restores a saved review and rejects saves that no longer fit', () => {
    const midway = play([{ type: 'start' }, ...answerAll([1]).slice(0, 8)]);
    expect(midway.practiceIndex).toBe(4);
    expect(restoreReview(ITEMS, JSON.parse(JSON.stringify(midway)))).toEqual(midway);

    expect(restoreReview(ITEMS, null)).toEqual(INITIAL_REVIEW);
    expect(restoreReview(ITEMS, { phase: 'practice' })).toEqual(INITIAL_REVIEW);
    expect(
      restoreReview(ITEMS, {
        ...midway,
        answers: [{ ...midway.answers[0], exerciseId: 'gone' }, ...midway.answers.slice(1)],
      }),
    ).toEqual(INITIAL_REVIEW);
    expect(restoreReview(ITEMS, { ...midway, phase: 'result' })).toEqual(INITIAL_REVIEW);
  });
});
