import { WEEK_12_EXAM } from '@/data/content/exams/week-12';
import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { loadJourney } from '@/features/journey/use-cases';
import { completeQuest, loadProgressState } from '@/features/progress/use-cases';
import type { QuestCompletion, ExamAttempt } from '@/schemas';

import { withExamAnswer } from '../logic/exam';
import { loadExamRun, saveExamAttempt, startExamAttempt, submitExam } from '../use-cases';

type Repositories = ReturnType<typeof createMemoryRepositories>;
const EXAM_QUEST = questId(84, 'weeklyExam');
const AT = '2026-09-18T10:00:00.000Z';

/** Day 84 with Days 1–83 finished (streak 83); `warmUp` also finishes the exam day's first quests. */
async function setup({ warmUp = true } = {}): Promise<Repositories> {
  const repositories = createMemoryRepositories(getStartDateForDay(84, new Date()));
  const plans = await repositories.challenge.getDailyChallenges();
  const history: QuestCompletion[] = plans
    .filter((plan) => plan.day < 84)
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 0.8,
        correctCount: 4,
        totalCount: 5,
        xpEarned: 0,
        source: 'dev' as const,
        completedAt: AT,
      })),
    );
  await repositories.dev?.seedHistory(history, [], [], []);
  if (warmUp) {
    for (const type of ['vocabulary', 'review'] as const) {
      await completeQuest(repositories, {
        questId: questId(84, type),
        correctCount: 5,
        totalCount: 6,
      });
    }
  }
  return repositories;
}

/** Answers every question of an attempt: the first `skip` stay empty, the next `wrong` are missed. */
async function answer(
  repositories: Repositories,
  attempt: ExamAttempt,
  { wrong = 0, skip = 0 } = {},
): Promise<ExamAttempt> {
  let current = attempt;
  WEEK_12_EXAM.questions.forEach((question, index) => {
    if (index < skip) return;
    const missed = index < skip + wrong;
    const option = missed
      ? (question.options.find((item) => item.id !== question.correctOptionId)?.id ?? '')
      : question.correctOptionId;
    current = withExamAnswer(current, question, option, AT);
  });
  await saveExamAttempt(repositories, current);
  return current;
}

const examXp = (repositories: Repositories) =>
  repositories.store.xpEvents
    .filter((event) => event.reason === 'examPass')
    .reduce((sum, event) => sum + event.amount, 0);

describe('weekly exam flow', () => {
  it('opens after the warm-up on its day and resumes where it was left', async () => {
    expect((await loadExamRun(await setup({ warmUp: false }), EXAM_QUEST)).status).toBe('locked');

    const repositories = await setup();
    expect((await loadExamRun(repositories, EXAM_QUEST)).status).toBe('available');
    const attempt = await startExamAttempt(repositories, EXAM_QUEST);
    let current = attempt;
    for (const question of WEEK_12_EXAM.questions.slice(0, 7)) {
      current = withExamAnswer(current, question, question.correctOptionId, AT);
    }
    await saveExamAttempt(repositories, { ...current, currentIndex: 7 });

    const run = await loadExamRun(repositories, EXAM_QUEST);
    expect(run.status).toBe('inProgress');
    expect(run.open).toMatchObject({ id: attempt.id, currentIndex: 7 });
    expect(run.open?.answers).toHaveLength(7);
    // Home shows it in progress.
    expect(repositories.store.sessions.get(EXAM_QUEST)?.progress).toBeCloseTo(7 / 15);
    // Starting again resumes the same attempt: one open attempt at a time.
    expect((await startExamAttempt(repositories, EXAM_QUEST)).id).toBe(attempt.id);
  });

  it('pays the pass reward once; a double submit changes nothing', async () => {
    const repositories = await setup();
    const attempt = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST), {
      wrong: 3,
    });
    const submissions = await Promise.all([
      submitExam(repositories, attempt.id),
      submitExam(repositories, attempt.id),
    ]);
    const first = submissions.filter((submission) => submission.isFirstSubmission);
    expect(first).toHaveLength(1);
    expect(first[0]?.result).toMatchObject({ correctCount: 12, totalCount: 15, passed: true });
    expect(first[0]).toMatchObject({ rewardGranted: true, xpEarned: 100, dayCompleted: true });
    expect(examXp(repositories)).toBe(100);
    // The exam was the day's last quest: the day, not the pass, moves the streak.
    expect((await loadProgressState(repositories)).streak).toBe(84);

    // Submitting again later (a reload): the stored result, no second reward.
    const again = await submitExam(repositories, attempt.id);
    expect(again).toMatchObject({ isFirstSubmission: false, rewardGranted: false, xpEarned: 0 });
    expect(again.result.correctCount).toBe(12);
    expect(examXp(repositories)).toBe(100);
    expect((await loadExamRun(repositories, EXAM_QUEST)).rewardPaid).toBe(true);
  });

  it('counts unanswered questions as not right', async () => {
    const repositories = await setup();
    const attempt = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST), {
      skip: 2,
    });
    const submission = await submitExam(repositories, attempt.id);
    expect(submission.result).toMatchObject({ correctCount: 13, unansweredCount: 2 });
  });

  it('keeps submitted answers final: a stale save is refused', async () => {
    const repositories = await setup();
    const attempt = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST));
    await submitExam(repositories, attempt.id);
    const [question] = WEEK_12_EXAM.questions;
    if (!question) throw new Error('no question');
    const other = question.options.find((option) => option.id !== question.correctOptionId);
    // A screen still holding the open attempt tries to change an answer.
    await saveExamAttempt(repositories, withExamAnswer(attempt, question, other?.id ?? '', AT));

    const run = await loadExamRun(repositories, EXAM_QUEST);
    expect(run.open).toBeNull();
    expect(run.best?.answers).toEqual(attempt.answers);
    expect(run.best?.correctCount).toBe(15);
  });

  it('lets an exam be retaken; the reward comes once and the streak stays', async () => {
    const repositories = await setup();
    const failed = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST), {
      wrong: 6,
    });
    const first = await submitExam(repositories, failed.id);
    expect(first.result).toMatchObject({ correctCount: 9, passed: false });
    expect(first).toMatchObject({ rewardGranted: false, xpEarned: 0, dayCompleted: true });
    expect((await loadExamRun(repositories, EXAM_QUEST)).status).toBe('notPassed');
    const streak = (await loadProgressState(repositories)).streak;
    const xp = (await loadProgressState(repositories)).totalXp;

    const retake = await startExamAttempt(repositories, EXAM_QUEST);
    expect(retake).toMatchObject({ number: 2, answers: [] });
    const passed = await submitExam(
      repositories,
      (await answer(repositories, retake, { wrong: 1 })).id,
    );
    expect(passed).toMatchObject({ rewardGranted: true, xpEarned: 100, dayCompleted: false });

    const third = await startExamAttempt(repositories, EXAM_QUEST);
    const perfect = await submitExam(repositories, (await answer(repositories, third)).id);
    expect(perfect.result.isPerfect).toBe(true);
    expect(perfect.rewardGranted).toBe(false);

    const after = await loadProgressState(repositories);
    expect(examXp(repositories)).toBe(100);
    expect(after.totalXp).toBe(xp + 100);
    expect(after.streak).toBe(streak);
  });

  it('shows the exam on the map: available, in progress, passed', async () => {
    const repositories = await setup();
    const examDay = () => loadJourney(repositories).then((journey) => journey.days[83]?.exam);
    expect(await examDay()).toMatchObject({ status: 'available', bestScore: null });

    const attempt = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST), {
      wrong: 2,
    });
    expect((await examDay())?.status).toBe('inProgress');
    await submitExam(repositories, attempt.id);
    expect(await examDay()).toMatchObject({
      status: 'passed',
      bestScore: 13 / 15,
      submittedAttempts: 1,
    });
  });

  it('never counts a perfect exam as a Perfect Quiz', async () => {
    const repositories = await setup();
    const attempt = await answer(repositories, await startExamAttempt(repositories, EXAM_QUEST));
    const submission = await submitExam(repositories, attempt.id);
    expect(submission.result.isPerfect).toBe(true);
    expect(submission.newAchievements.map((achievement) => achievement.id)).not.toContain(
      'perfectQuiz',
    );
  });
});
