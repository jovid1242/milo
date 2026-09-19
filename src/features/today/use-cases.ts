import type { Repositories } from '@/data/repositories/types';
import { findTomorrow } from '@/features/challenge/logic/tomorrow';
import { loadExamRun } from '@/features/exams/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';

import { buildTodayJourney, type TodayJourney } from './logic/today-journey';

/** Reads the current day's plan and progress and derives the Home view. */
export async function loadTodayJourney(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<TodayJourney> {
  const progress = await loadProgressState(repositories, now);
  const [chapters, plans, completions, sessions, dayCompletion] = await Promise.all([
    repositories.challenge.getChapters(),
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletionsForDays([progress.currentDay]),
    repositories.progress.getQuestSessions(),
    repositories.progress.getDayCompletion(progress.currentDay),
  ]);
  const plan = plans.find((item) => item.day === progress.currentDay);
  if (!plan) throw new Error(`No plan for day ${progress.currentDay}`);
  // A handed-in exam shows whether it is passed (a retake may have passed it since).
  const examQuest = plan.quests.find(
    (quest) => quest.type === 'weeklyExam' || quest.type === 'finalBattle',
  );
  const examStatus = examQuest ? (await loadExamRun(repositories, examQuest.id, now)).status : null;
  const exam =
    examQuest && (examStatus === 'passed' || examStatus === 'notPassed')
      ? { questId: examQuest.id, passed: examStatus === 'passed' }
      : null;
  return buildTodayJourney({
    plan,
    chapters,
    progress,
    completions,
    sessions,
    dayCompletion,
    tomorrow: findTomorrow(plans, plan.day),
    exam,
  });
}
