import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import type { ChoiceAnswer } from '@/schemas';

import { finishQuestRun, loadQuestRun, saveQuestRun } from '../use-cases';

const AT = '2026-09-18T10:00:00.000Z';
const QUEST_ID = questId(89, 'vocabulary');

function setup() {
  return createMemoryRepositories(getStartDateForDay(89, new Date()));
}

/** Six answers for the Day 89 vocabulary quest, `wrong` of them incorrect. */
const answers = (wrong = 0): ChoiceAnswer[] =>
  Array.from({ length: 6 }, (_, index) => ({
    exerciseId: `d089-vocab-${index + 1}`,
    optionId: 'x',
    correct: index >= wrong,
    answeredAt: AT,
  }));

describe('quest runs (shared by every quest type)', () => {
  it('awards the quest XP on the first completion only', async () => {
    const repositories = setup();

    const first = await finishQuestRun(repositories, {
      questId: QUEST_ID,
      answers: answers(1),
      exerciseCount: 6,
    });
    expect(first).toMatchObject({ isFirstCompletion: true, xpEarned: 20 });

    const replay = await finishQuestRun(repositories, {
      questId: QUEST_ID,
      answers: answers(0),
      exerciseCount: 6,
    });
    expect(replay).toMatchObject({ isFirstCompletion: false, xpEarned: 0 });
    expect(await repositories.progress.getTotalXp()).toBe(20);

    // The first result stays the official one.
    const [completion] = await repositories.progress.getCompletions();
    expect(completion).toMatchObject({ correctCount: 5, totalCount: 6, xpEarned: 20 });
  });

  it('cannot award XP twice even when completions race', async () => {
    const repositories = setup();
    const input = { questId: QUEST_ID, answers: answers(), exerciseCount: 6 };
    const outcomes = await Promise.all([
      finishQuestRun(repositories, input),
      finishQuestRun(repositories, input),
    ]);

    expect(outcomes.filter((outcome) => outcome.isFirstCompletion)).toHaveLength(1);
    const questXp = repositories.store.xpEvents.filter((event) => event.reason === 'quest');
    expect(questXp).toHaveLength(1);
  });

  it('saves a run and opens it again where it was left', async () => {
    const repositories = setup();
    const state = { anything: 'the quest type decides', step: 3 };
    await saveQuestRun(repositories, { questId: QUEST_ID, startedAt: AT, progress: 0.25, state });

    const run = await loadQuestRun(repositories, QUEST_ID);
    expect(run.savedState).toEqual(state);
    expect(run.startedAt).toBe(AT);
    expect(run.completion).toBeNull();
    expect(run.content?.type).toBe('vocabulary');

    // Finishing closes the session: nothing is left to resume.
    await finishQuestRun(repositories, { questId: QUEST_ID, answers: answers(), exerciseCount: 6 });
    const finished = await loadQuestRun(repositories, QUEST_ID);
    expect(finished.savedState).toBeNull();
    expect(finished.completion).not.toBeNull();
  });
});
