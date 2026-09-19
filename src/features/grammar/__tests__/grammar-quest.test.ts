import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { finishQuestRun, loadQuestRun, saveQuestRun } from '@/features/quests/use-cases';
import { loadTodayJourney } from '@/features/today/use-cases';
import type { ChoiceAnswer, GrammarQuest } from '@/schemas';

import {
  INITIAL_GRAMMAR,
  grammarProgress,
  reduceGrammar,
  restoreGrammar,
  type GrammarAction,
} from '../logic/grammar-session';

const DAY = 89;
const GRAMMAR_ID = questId(DAY, 'grammar');
const VOCABULARY_ID = questId(DAY, 'vocabulary');
const AT = '2026-09-18T10:00:00.000Z';

function setup() {
  return createMemoryRepositories(getStartDateForDay(DAY, new Date()));
}

async function grammarOf(repositories: ReturnType<typeof setup>): Promise<GrammarQuest> {
  const { content } = await loadQuestRun(repositories, GRAMMAR_ID);
  if (content?.type !== 'grammar') throw new Error('Day 89 has no grammar content');
  return content;
}

/** Vocabulary done with one miss: +20 XP, no perfect bonus, no badge. */
async function finishVocabulary(repositories: ReturnType<typeof setup>) {
  const answers: ChoiceAnswer[] = Array.from({ length: 6 }, (_, index) => ({
    exerciseId: `d089-vocab-${index + 1}`,
    optionId: 'x',
    correct: index > 0,
    answeredAt: AT,
  }));
  await finishQuestRun(repositories, { questId: VOCABULARY_ID, answers, exerciseCount: 6 });
}

function actionsFor(quest: GrammarQuest, wrongAt: number[]): GrammarAction[] {
  return [
    { type: 'start' },
    { type: 'ruleLearned' },
    ...quest.examples.flatMap((): GrammarAction[] => [
      { type: 'revealExample' },
      { type: 'nextExample' },
    ]),
    ...quest.exercises.flatMap((exercise, index): GrammarAction[] => {
      const wrong = exercise.options.find((option) => option.id !== exercise.correctOptionId);
      const optionId = wrongAt.includes(index) ? (wrong?.id ?? '') : exercise.correctOptionId;
      return [{ type: 'answer', optionId, at: AT }, { type: 'continue' }];
    }),
  ];
}

async function playGrammar(repositories: ReturnType<typeof setup>, wrongAt: number[] = [1]) {
  const quest = await grammarOf(repositories);
  const state = actionsFor(quest, wrongAt).reduce(
    (current, action) => reduceGrammar(quest, current, action),
    INITIAL_GRAMMAR,
  );
  expect(state.phase).toBe('result');
  return finishQuestRun(repositories, {
    questId: GRAMMAR_ID,
    answers: state.answers,
    exerciseCount: quest.exercises.length,
  });
}

describe('grammar quest', () => {
  it('awards exactly +15 XP once; completing it again earns nothing', async () => {
    const repositories = setup();
    await finishVocabulary(repositories);

    const first = await playGrammar(repositories);
    expect(first).toMatchObject({ isFirstCompletion: true, xpEarned: 15, isPerfect: false });
    expect(await repositories.progress.getTotalXp()).toBe(35);

    const again = await playGrammar(repositories, []);
    expect(again).toMatchObject({ isFirstCompletion: false, xpEarned: 0 });
    expect(await repositories.progress.getTotalXp()).toBe(35);
  });

  it('unlocks Reading and makes today 2 of 4', async () => {
    const repositories = setup();
    await finishVocabulary(repositories);
    const before = await loadTodayJourney(repositories);
    expect(before.steps.map((step) => step.status)).toEqual([
      'completed',
      'available',
      'locked',
      'locked',
    ]);

    await playGrammar(repositories);

    const after = await loadTodayJourney(repositories);
    expect(after.steps.map((step) => [step.quest.type, step.status])).toEqual([
      ['vocabulary', 'completed'],
      ['grammar', 'completed'],
      ['reading', 'available'],
      ['review', 'locked'],
    ]);
    expect(after.completedCount).toBe(2);
    expect(after.xpEarnedToday).toBe(35);
  });

  it('resumes at a guided example or at exercise 3 of 6, shown in progress on Home', async () => {
    const repositories = setup();
    await finishVocabulary(repositories);
    const quest = await grammarOf(repositories);
    const actions = actionsFor(quest, []);

    // Rule read, first example explained / rule, examples and two answers done.
    for (const steps of [3, 2 + quest.examples.length * 2 + 4]) {
      const state = actions
        .slice(0, steps)
        .reduce((current, action) => reduceGrammar(quest, current, action), INITIAL_GRAMMAR);
      await saveQuestRun(repositories, {
        questId: GRAMMAR_ID,
        startedAt: AT,
        progress: grammarProgress(quest, state),
        state,
      });

      const reopened = await loadQuestRun(repositories, GRAMMAR_ID);
      expect(restoreGrammar(quest, reopened.savedState)).toEqual(state);
      const home = await loadTodayJourney(repositories);
      expect(home.steps[1]?.status).toBe('inProgress');
      expect(home.steps[1]?.progress).toBeCloseTo(grammarProgress(quest, state));
    }
  });

  it('a perfect run adds the perfect bonus', async () => {
    const repositories = setup();
    await finishVocabulary(repositories);
    const perfect = await playGrammar(repositories, []);
    expect(perfect).toMatchObject({ isPerfect: true, xpEarned: 25 });
  });
});
