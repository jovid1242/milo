import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { loadTodayJourney } from '@/features/today/use-cases';
import type { VocabularyAction } from '@/features/vocabulary/logic/vocabulary-session';

import { INITIAL_PROGRESS, reduceVocabulary } from '../logic/vocabulary-session';
import { completeVocabularyQuest, loadVocabularyQuest, saveVocabularyProgress } from '../use-cases';

const DAY = 89;
const QUEST_ID = questId(DAY, 'vocabulary');
const AT = '2026-09-18T10:00:00.000Z';

function setup() {
  return createMemoryRepositories(getStartDateForDay(DAY, new Date()));
}

async function playThrough(
  repositories: ReturnType<typeof setup>,
  { wrongAt = [] as number[] } = {},
) {
  const { content } = await loadVocabularyQuest(repositories, QUEST_ID);
  if (!content) throw new Error('Day 89 has no vocabulary content');
  const actions: VocabularyAction[] = [
    { type: 'start' },
    ...content.items.flatMap((): VocabularyAction[] => [{ type: 'reveal' }, { type: 'learned' }]),
    ...content.exercises.flatMap((exercise, index): VocabularyAction[] => {
      const wrong = exercise.optionItemIds.find((id) => id !== exercise.itemId) ?? '';
      const optionItemId = wrongAt.includes(index) ? wrong : exercise.itemId;
      return [{ type: 'answer', optionItemId, at: AT }, { type: 'continue' }];
    }),
  ];
  const progress = actions.reduce(
    (state, action) => reduceVocabulary(content, state, action),
    INITIAL_PROGRESS,
  );
  return completeVocabularyQuest(repositories, { content, progress });
}

describe('vocabulary quest', () => {
  it('awards the quest XP once, on the first completion', async () => {
    const repositories = setup();

    const first = await playThrough(repositories, { wrongAt: [2] });
    expect(first.isFirstCompletion).toBe(true);
    expect(first.xpEarned).toBe(20);
    expect(await repositories.progress.getTotalXp()).toBe(20);

    const replay = await playThrough(repositories);
    expect(replay.isFirstCompletion).toBe(false);
    expect(replay.xpEarned).toBe(0);
    expect(await repositories.progress.getTotalXp()).toBe(20);

    // The first result stays the official one.
    const [completion] = await repositories.progress.getCompletions();
    expect(completion).toMatchObject({ correctCount: 5, totalCount: 6, xpEarned: 20 });
  });

  it('cannot award XP twice even when completions race', async () => {
    const repositories = setup();
    const outcomes = await Promise.all([playThrough(repositories), playThrough(repositories)]);

    expect(outcomes.filter((outcome) => outcome.isFirstCompletion)).toHaveLength(1);
    const questXp = repositories.store.xpEvents.filter((event) => event.reason === 'quest');
    expect(questXp).toHaveLength(1);
  });

  it('adds the perfect bonus for 6 of 6', async () => {
    const outcome = await playThrough(setup());
    expect(outcome.isPerfect).toBe(true);
    expect(outcome.xpEarned).toBe(30);
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

    await playThrough(repositories, { wrongAt: [0] });

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
    const { content } = await loadVocabularyQuest(repositories, QUEST_ID);
    if (!content) throw new Error('Day 89 has no vocabulary content');

    const midway = [
      { type: 'start' },
      { type: 'reveal' },
      { type: 'learned' },
      { type: 'reveal' },
    ].reduce(
      (state, action) => reduceVocabulary(content, state, action as VocabularyAction),
      INITIAL_PROGRESS,
    );
    await saveVocabularyProgress(repositories, { content, progress: midway, startedAt: AT });

    const reopened = await loadVocabularyQuest(repositories, QUEST_ID);
    expect(reopened.progress).toEqual(midway);
    expect(reopened.startedAt).toBe(AT);

    const home = await loadTodayJourney(repositories);
    expect(home.steps[0]?.status).toBe('inProgress');
    expect(home.steps[0]?.progress).toBeCloseTo(1 / 12);
  });
});
