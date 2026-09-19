import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { finishQuestRun, loadQuestRun, saveQuestRun } from '@/features/quests/use-cases';
import { loadTodayJourney } from '@/features/today/use-cases';
import type { ChoiceAnswer, ReadingQuest } from '@/schemas';

import {
  INITIAL_READING,
  readingProgress,
  reduceReading,
  restoreReading,
  type ReadingAction,
} from '../logic/reading-session';

const DAY = 89;
const READING_ID = questId(DAY, 'reading');
const AT = '2026-09-18T10:00:00.000Z';

function setup() {
  return createMemoryRepositories(getStartDateForDay(DAY, new Date()));
}

/** Vocabulary and Grammar done with one miss each: +20 and +15, no bonus, no badge. */
async function finishEarlierQuests(repositories: ReturnType<typeof setup>) {
  const withOneMiss = (prefix: string): ChoiceAnswer[] =>
    Array.from({ length: 6 }, (_, index) => ({
      exerciseId: `${prefix}-${index + 1}`,
      optionId: 'x',
      correct: index > 0,
      answeredAt: AT,
    }));
  await finishQuestRun(repositories, {
    questId: questId(DAY, 'vocabulary'),
    answers: withOneMiss('d089-vocab'),
    exerciseCount: 6,
  });
  await finishQuestRun(repositories, {
    questId: questId(DAY, 'grammar'),
    answers: withOneMiss('d089-grammar'),
    exerciseCount: 6,
  });
}

async function storyOf(repositories: ReturnType<typeof setup>): Promise<ReadingQuest> {
  const { content } = await loadQuestRun(repositories, READING_ID);
  if (content?.type !== 'reading') throw new Error('Day 89 has no reading content');
  return content;
}

function actionsFor(quest: ReadingQuest, wrongAt: number[]): ReadingAction[] {
  return [
    { type: 'start' },
    { type: 'openWord', wordId: 'gradually' },
    { type: 'reachEnd' },
    { type: 'finishReading' },
    ...quest.questions.flatMap((question, index): ReadingAction[] => {
      const wrong = question.options.find((option) => option.id !== question.correctOptionId);
      const optionId = wrongAt.includes(index) ? (wrong?.id ?? '') : question.correctOptionId;
      return [{ type: 'answer', optionId, at: AT }, { type: 'continue' }];
    }),
  ];
}

async function playReading(repositories: ReturnType<typeof setup>, wrongAt: number[] = [2]) {
  const quest = await storyOf(repositories);
  const state = actionsFor(quest, wrongAt).reduce(
    (current, action) => reduceReading(quest, current, action),
    INITIAL_READING,
  );
  expect(state.phase).toBe('result');
  return finishQuestRun(repositories, {
    questId: READING_ID,
    answers: state.answers,
    exerciseCount: quest.questions.length,
  });
}

describe('reading quest', () => {
  it('awards exactly +20 XP once; reading it again earns nothing', async () => {
    const repositories = setup();
    await finishEarlierQuests(repositories);
    expect(await repositories.progress.getTotalXp()).toBe(35);

    const first = await playReading(repositories);
    expect(first).toMatchObject({ isFirstCompletion: true, xpEarned: 20, isPerfect: false });
    expect(await repositories.progress.getTotalXp()).toBe(55);

    const again = await playReading(repositories, []);
    expect(again).toMatchObject({ isFirstCompletion: false, xpEarned: 0 });
    expect(await repositories.progress.getTotalXp()).toBe(55);
  });

  it('unlocks Review and makes today 3 of 4', async () => {
    const repositories = setup();
    await finishEarlierQuests(repositories);
    expect((await loadTodayJourney(repositories)).steps[2]?.status).toBe('available');

    await playReading(repositories);

    const today = await loadTodayJourney(repositories);
    expect(today.steps.map((step) => [step.quest.type, step.status])).toEqual([
      ['vocabulary', 'completed'],
      ['grammar', 'completed'],
      ['reading', 'completed'],
      ['review', 'available'],
    ]);
    expect(today.completedCount).toBe(3);
    expect(today.xpEarnedToday).toBe(55);
  });

  it('resumes halfway through the story or at question 3, shown in progress on Home', async () => {
    const repositories = setup();
    await finishEarlierQuests(repositories);
    const quest = await storyOf(repositories);

    const halfway: ReadingAction[] = [{ type: 'start' }, { type: 'readTo', paragraphIndex: 3 }];
    const atQuestion3 = actionsFor(quest, []).slice(0, 8);
    for (const actions of [halfway, atQuestion3]) {
      const state = actions.reduce(
        (current, action) => reduceReading(quest, current, action),
        INITIAL_READING,
      );
      await saveQuestRun(repositories, {
        questId: READING_ID,
        startedAt: AT,
        progress: readingProgress(quest, state),
        state,
      });

      const reopened = await loadQuestRun(repositories, READING_ID);
      expect(restoreReading(quest, reopened.savedState)).toEqual(state);
      expect((await loadTodayJourney(repositories)).steps[2]?.status).toBe('inProgress');
    }
  });

  it('a perfect run adds the perfect bonus', async () => {
    const repositories = setup();
    await finishEarlierQuests(repositories);
    expect(await playReading(repositories, [])).toMatchObject({ isPerfect: true, xpEarned: 30 });
  });
});
