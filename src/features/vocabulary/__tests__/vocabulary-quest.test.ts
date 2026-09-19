import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { finishQuestRun, loadQuestRun, saveQuestRun } from '@/features/quests/use-cases';
import { loadTodayJourney } from '@/features/today/use-cases';
import type { VocabularyQuest } from '@/schemas';

import {
  INITIAL_PROGRESS,
  progressFraction,
  reduceVocabulary,
  restoreProgress,
  type VocabularyAction,
} from '../logic/vocabulary-session';

const QUEST_ID = questId(89, 'vocabulary');
const AT = '2026-09-18T10:00:00.000Z';

function setup() {
  return createMemoryRepositories(getStartDateForDay(89, new Date()));
}

async function contentOf(repositories: ReturnType<typeof setup>): Promise<VocabularyQuest> {
  const { content } = await loadQuestRun(repositories, QUEST_ID);
  if (content?.type !== 'vocabulary') throw new Error('Day 89 has no vocabulary content');
  return content;
}

async function playThrough(repositories: ReturnType<typeof setup>, wrongAt: number[] = []) {
  const content = await contentOf(repositories);
  const actions: VocabularyAction[] = [
    { type: 'start' },
    ...content.items.flatMap((): VocabularyAction[] => [{ type: 'reveal' }, { type: 'learned' }]),
    ...content.exercises.flatMap((exercise, index): VocabularyAction[] => {
      const wrong = exercise.optionItemIds.find((id) => id !== exercise.itemId) ?? '';
      const optionId = wrongAt.includes(index) ? wrong : exercise.itemId;
      return [{ type: 'answer', optionId, at: AT }, { type: 'continue' }];
    }),
  ];
  const state = actions.reduce(
    (current, action) => reduceVocabulary(content, current, action),
    INITIAL_PROGRESS,
  );
  return finishQuestRun(repositories, {
    questId: QUEST_ID,
    answers: state.answers,
    exerciseCount: content.exercises.length,
  });
}

describe('vocabulary quest', () => {
  it('earns +20 XP, and +10 more for a perfect run', async () => {
    expect((await playThrough(setup(), [2])).xpEarned).toBe(20);

    const perfect = await playThrough(setup());
    expect(perfect.isPerfect).toBe(true);
    expect(perfect.xpEarned).toBe(30);
  });

  it('unlocks Grammar on Home once Vocabulary is done', async () => {
    const repositories = setup();
    const before = await loadTodayJourney(repositories);
    expect(before.steps.map((step) => step.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
    ]);

    await playThrough(repositories, [0]);

    const after = await loadTodayJourney(repositories);
    expect(after.steps.map((step) => [step.quest.type, step.status])).toEqual([
      ['vocabulary', 'completed'],
      ['grammar', 'available'],
      ['reading', 'locked'],
      ['review', 'locked'],
    ]);
    expect(after.completedCount).toBe(1);
    expect(after.xpEarnedToday).toBe(20);
  });

  it('resumes exactly where the user left, and shows it as in progress', async () => {
    const repositories = setup();
    const content = await contentOf(repositories);

    const midway = (
      [{ type: 'start' }, { type: 'reveal' }, { type: 'learned' }, { type: 'reveal' }] as const
    ).reduce<typeof INITIAL_PROGRESS>(
      (state, action) => reduceVocabulary(content, state, action),
      INITIAL_PROGRESS,
    );
    await saveQuestRun(repositories, {
      questId: QUEST_ID,
      startedAt: AT,
      progress: progressFraction(content, midway),
      state: midway,
    });

    const reopened = await loadQuestRun(repositories, QUEST_ID);
    expect(restoreProgress(content, reopened.savedState)).toEqual(midway);

    const home = await loadTodayJourney(repositories);
    expect(home.steps[0]?.status).toBe('inProgress');
    expect(home.steps[0]?.progress).toBeCloseTo(1 / 12);
  });
});
