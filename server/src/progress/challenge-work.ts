import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import type { CourseReader } from '@/data/repositories/course/course-reader';
import {
  buildAchievementFacts,
  findNewlyEarned,
} from '@/features/achievements/logic/evaluate-achievements';
import { challengeDayOn } from '@/features/challenge/logic/calendar';
import { examAnswersFit, scoreExam } from '@/features/exams/logic/exam';
import { buildDayCompletion, findCompletedDays } from '@/features/progress/logic/day-completion';
import {
  questReward,
  scorableExercises,
  scoreQuestAnswers,
} from '@/features/progress/logic/quest-scoring';
import { diffInCalendarDays } from '@/lib/dates';
import { isKnownTimeZone, localDateIn } from '@/lib/time-zone';
import {
  AchievementSchema,
  PROGRESS_SYNC,
  type AchievementId,
  type CompleteQuestPayload,
  type CourseDay,
  type DayCompletion,
  type DayNumber,
  type ExamAnswer,
  type ImportLegacyProgressPayload,
  type LocalDate,
  type MutationRejectionCode,
  type Quest,
  type QuestAnswerInput,
  type QuestCompletion,
  type QuestType,
  type StartChallengePayload,
  type SubmitExamPayload,
} from '@/schemas';

/**
 * The rules of progress, applied by the server: what a mutation may do and
 * what it earns. Pure — the state comes in, the records to write come out —
 * so every rule is decided in one place and in one transaction (see
 * `ProgressService`). The scoring, rewards, day records, streaks and badges
 * are the app's own functions: the device predicts exactly what the server
 * then confirms.
 */

/** The published course, indexed for looking quests up. */
export class CourseContent {
  readonly plans: CourseDay[];
  private readonly quests = new Map<string, { plan: CourseDay; quest: Quest; index: number }>();

  constructor(
    readonly id: string,
    readonly version: number,
    readonly reader: CourseReader,
  ) {
    this.plans = reader.days();
    for (const plan of this.plans) {
      plan.quests.forEach((quest, index) => this.quests.set(quest.id, { plan, quest, index }));
    }
  }

  locate(questId: string) {
    return this.quests.get(questId) ?? null;
  }
}

export type ChallengeRecord = {
  /** `null` for a challenge started by this work, not stored yet. */
  id: string | null;
  courseId: string;
  startDate: LocalDate;
  timeZone: string;
  startedAt: Date;
  completedAt: Date | null;
  finalAttemptId: string | null;
  revision: number;
};

export type CompletionRecord = {
  questId: string;
  day: number;
  questType: QuestType;
  courseVersion: number;
  correctCount: number;
  totalCount: number;
  xpEarned: number;
  completedAt: Date;
};

export type DayRecord = {
  day: number;
  questCount: number;
  xpEarned: number;
  streakBefore: number;
  streakAfter: number;
  isPerfect: boolean;
  completedAt: Date;
};

export type WordRecord = { wordId: string; questId: string; learnedAt: Date };

export type AttemptRecord = {
  attemptId: string;
  examId: string;
  questId: string;
  number: number;
  courseVersion: number;
  answers: ExamAnswer[];
  correctCount: number;
  totalCount: number;
  passed: boolean;
  submittedAt: Date;
};

export type XpReason = 'quest' | 'examPass' | 'achievement';
export type LedgerRecord = { reason: XpReason; refId: string; amount: number; createdAt: Date };
export type UnlockRecord = { achievementId: AchievementId; unlockedAt: Date };

/** A challenge and everything recorded under it, as stored. */
export type ChallengeState = {
  challenge: ChallengeRecord | null;
  completions: CompletionRecord[];
  days: DayRecord[];
  words: WordRecord[];
  attempts: AttemptRecord[];
  ledger: LedgerRecord[];
  unlocks: UnlockRecord[];
};

export const emptyState = (): ChallengeState => ({
  challenge: null,
  completions: [],
  days: [],
  words: [],
  attempts: [],
  ledger: [],
  unlocks: [],
});

/** What a mutation adds. Records are only ever added — except a weekly exam's reward, added to its quest. */
export type ChallengeWrites = {
  /** A challenge started by this work. */
  challenge: ChallengeRecord | null;
  completions: (CompletionRecord & { answers: QuestAnswerInput[] | null })[];
  completionXp: { questId: string; add: number }[];
  days: DayRecord[];
  words: WordRecord[];
  attempts: AttemptRecord[];
  ledger: LedgerRecord[];
  unlocks: UnlockRecord[];
  /** The summit, reached now. */
  summit: { completedAt: Date; finalAttemptId: string } | null;
};

export type Rejection = { code: MutationRejectionCode; message: string };

const reject = (code: MutationRejectionCode, message: string): Rejection => ({ code, message });

const DAILY_TYPES: ReadonlySet<QuestType> = new Set(['vocabulary', 'grammar', 'reading', 'review']);
const EXAM_TYPES: ReadonlySet<QuestType> = new Set(['weeklyExam', 'finalBattle']);

const DEFINITIONS = z.array(AchievementSchema).parse(ACHIEVEMENTS);

/** How a quest may be played: today (within the sync window), or — for history — any day already begun. */
type Availability = { history: boolean };

/**
 * One mutation's work on one challenge: validates it against the course and
 * the challenge, keeps the state current as records are added (a legacy
 * import adds many, each seeing the ones before it) and collects the writes.
 */
export class ChallengeWork {
  readonly writes: ChallengeWrites = {
    challenge: null,
    completions: [],
    completionXp: [],
    days: [],
    words: [],
    attempts: [],
    ledger: [],
    unlocks: [],
    summit: null,
  };

  private challenge: ChallengeRecord | null;
  private readonly completions = new Map<string, CompletionRecord>();
  private readonly days = new Map<number, DayRecord>();
  private readonly words = new Set<string>();
  private readonly attempts: AttemptRecord[];
  private readonly paid = new Set<string>();
  private readonly unlocked = new Set<AchievementId>();

  constructor(
    state: ChallengeState,
    private readonly course: CourseContent,
    private readonly now: Date,
  ) {
    this.challenge = state.challenge ? { ...state.challenge } : null;
    for (const completion of state.completions)
      this.completions.set(completion.questId, { ...completion });
    for (const day of state.days) this.days.set(day.day, day);
    for (const word of state.words) this.words.add(word.wordId);
    this.attempts = [...state.attempts];
    for (const entry of state.ledger) this.paid.add(`${entry.reason}:${entry.refId}`);
    for (const unlock of state.unlocks) this.unlocked.add(unlock.achievementId);
  }

  /** Whether the work has anything to write. */
  get changed(): boolean {
    const w = this.writes;
    return (
      w.challenge !== null ||
      w.summit !== null ||
      [w.completions, w.completionXp, w.days, w.words, w.attempts, w.ledger, w.unlocks].some(
        (list) => list.length > 0,
      )
    );
  }

  /** Starts the challenge. Started already, it stays as it is: a challenge starts once. */
  startChallenge(payload: StartChallengePayload): Rejection | null {
    if (payload.courseId !== this.course.id) return this.courseMismatch();
    if (this.challenge) return null;
    const invalid = this.checkStart(payload.startDate, payload.timeZone, { history: false });
    if (invalid) return invalid;
    this.begin(payload.startDate, payload.timeZone);
    return null;
  }

  /** Records a daily quest from its answers: scored here, paid once. Finished already, nothing changes. */
  completeQuest(payload: CompleteQuestPayload, availability: Availability): Rejection | null {
    if (payload.courseId !== this.course.id) return this.courseMismatch();
    if (!this.challenge) return reject('CHALLENGE_NOT_STARTED', 'The challenge has not started.');
    const located = this.course.locate(payload.questId);
    if (!located || !DAILY_TYPES.has(located.quest.type)) {
      return reject('UNKNOWN_QUEST', `"${payload.questId}" is not a daily quest of this course.`);
    }
    if (this.completions.has(payload.questId)) return null;
    const unavailable = this.checkAvailable(located, availability);
    if (unavailable) return unavailable;

    const content = this.course.reader.questContent(payload.questId);
    const exercises = content ? scorableExercises(content) : null;
    if (!content || !exercises) {
      return reject('UNKNOWN_QUEST', `"${payload.questId}" has no playable content.`);
    }
    const score = scoreQuestAnswers(exercises, payload.answers);
    if (!score) {
      return reject('INVALID_ANSWERS', 'The answers do not match the quest: one per exercise.');
    }

    const at = this.occurred(payload.completedAt);
    const reward = questReward(located.quest, score.isPerfect);
    this.addCompletion(
      {
        questId: located.quest.id,
        day: located.plan.day,
        questType: located.quest.type,
        courseVersion: payload.courseVersion,
        correctCount: score.correctCount,
        totalCount: score.totalCount,
        xpEarned: reward,
        completedAt: at,
      },
      payload.answers,
    );
    if (reward > 0) this.pay('quest', located.quest.id, reward, at);
    if (content.type === 'vocabulary') {
      for (const item of content.items) {
        if (this.words.has(item.id)) continue;
        this.words.add(item.id);
        this.writes.words.push({ wordId: item.id, questId: located.quest.id, learnedAt: at });
      }
    }
    this.settleDay(located.plan, at);
    return null;
  }

  /**
   * Scores a handed-in exam attempt. The pass reward is paid once per exam; a
   * weekly exam is finished by handing it in, the Final Battle only by passing
   * it — its first pass is the summit. An attempt recorded already changes nothing.
   */
  submitExam(payload: SubmitExamPayload, availability: Availability): Rejection | null {
    if (payload.courseId !== this.course.id) return this.courseMismatch();
    const challenge = this.challenge;
    if (!challenge) return reject('CHALLENGE_NOT_STARTED', 'The challenge has not started.');
    const located = this.course.locate(payload.questId);
    const content = located ? this.course.reader.questContent(payload.questId) : null;
    if (
      !located ||
      !EXAM_TYPES.has(located.quest.type) ||
      (content?.type !== 'weeklyExam' && content?.type !== 'finalBattle')
    ) {
      return reject('UNKNOWN_QUEST', `"${payload.questId}" is not an exam of this course.`);
    }
    const exam = content;
    if (this.attempts.some((attempt) => attempt.attemptId === payload.attemptId)) return null;

    const earlier = this.attempts.filter((attempt) => attempt.examId === exam.id);
    // A retake is always open; the first try only on its day, after the warm-up.
    if (earlier.length === 0 && !this.completions.has(located.quest.id)) {
      const unavailable = this.checkAvailable(located, availability);
      if (unavailable) return unavailable;
    }
    if (!examAnswersFit(exam, payload.answers)) {
      return reject('INVALID_ANSWERS', 'An answer is not one of the exam’s questions and options.');
    }

    const result = scoreExam(exam, payload.answers);
    const at = this.occurred(payload.submittedAt);
    const attempt: AttemptRecord = {
      attemptId: payload.attemptId,
      examId: exam.id,
      questId: located.quest.id,
      number: earlier.length + 1,
      courseVersion: payload.courseVersion,
      answers: payload.answers,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      passed: result.passed,
      submittedAt: at,
    };
    this.attempts.push(attempt);
    this.writes.attempts.push(attempt);

    const rewarded =
      result.passed && exam.xpReward > 0 && this.pay('examPass', exam.id, exam.xpReward, at);
    const earned = rewarded ? exam.xpReward : 0;
    const completion = this.completions.get(located.quest.id);
    if (completion) {
      // A retake: the quest keeps its first result; a first pass adds its reward.
      if (earned > 0) {
        completion.xpEarned += earned;
        this.writes.completionXp.push({ questId: completion.questId, add: earned });
      }
    } else if (exam.type === 'weeklyExam' || result.passed) {
      this.addCompletion(
        {
          questId: located.quest.id,
          day: located.plan.day,
          questType: located.quest.type,
          courseVersion: payload.courseVersion,
          correctCount: result.correctCount,
          totalCount: result.totalCount,
          xpEarned: earned,
          completedAt: at,
        },
        null,
      );
      this.settleDay(located.plan, at);
      if (exam.type === 'finalBattle' && challenge.completedAt === null) {
        challenge.completedAt = at;
        challenge.finalAttemptId = attempt.attemptId;
        this.writes.summit = { completedAt: at, finalAttemptId: attempt.attemptId };
      }
    }
    return null;
  }

  /**
   * Progress from before accounts, on an account that has no challenge yet:
   * the challenge starts on its old start date and every quest and exam is
   * replayed through the same rules — scored from its answers, in course
   * order — except the sync window: it is history. What does not pass is
   * left out; the rest is imported.
   */
  importLegacy(
    payload: ImportLegacyProgressPayload,
  ): Rejection | { imported: number; skipped: number } {
    if (payload.courseId !== this.course.id) return this.courseMismatch();
    if (this.challenge) {
      return reject('LEGACY_IMPORT_NOT_ALLOWED', 'The account has a challenge already.');
    }
    const invalid = this.checkStart(payload.startDate, payload.timeZone, { history: true });
    if (invalid) return invalid;
    this.begin(payload.startDate, payload.timeZone);

    const position = (questId: string) => {
      const located = this.course.locate(questId);
      return located ? located.plan.day * 100 + located.index : Number.MAX_SAFE_INTEGER;
    };
    let imported = 0;
    let skipped = 0;
    const count = (rejection: Rejection | null) => (rejection ? skipped++ : imported++);
    const history = { history: true };
    // Quests first, in course order: the warm-up is in place before each day's exam.
    for (const quest of [...payload.quests].sort(
      (a, b) => position(a.questId) - position(b.questId),
    )) {
      count(
        this.completeQuest(
          { ...quest, courseId: payload.courseId, courseVersion: payload.courseVersion },
          history,
        ),
      );
    }
    const exams = [...payload.exams].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    for (const exam of exams) {
      count(
        this.submitExam(
          { ...exam, courseId: payload.courseId, courseVersion: payload.courseVersion },
          history,
        ),
      );
    }
    return { imported, skipped };
  }

  /**
   * Unlocks every badge whose rule the progress now meets, and pays its XP —
   * once each, with the app's own rules. The team badge needs Friends, which
   * the server does not have yet: it stays locked.
   */
  settleAchievements(at: Date): void {
    if (!this.challenge) return;
    const completions = this.completionList();
    const facts = buildAchievementFacts({
      plans: this.course.plans,
      completions,
      dayCompletions: this.dayList(),
      uniqueWords: this.words.size,
      currentDay: this.serverDay(),
      teamStreak: null,
    });
    for (const achievement of findNewlyEarned(DEFINITIONS, facts, this.unlocked)) {
      this.unlocked.add(achievement.id);
      this.writes.unlocks.push({ achievementId: achievement.id, unlockedAt: at });
      if (achievement.xpReward > 0)
        this.pay('achievement', achievement.id, achievement.xpReward, at);
    }
  }

  /** The challenge day on the server's clock, in the challenge's time zone. */
  serverDay(): DayNumber {
    if (!this.challenge) throw new Error('No challenge');
    return challengeDayOn(this.challenge.startDate, localDateIn(this.challenge.timeZone, this.now));
  }

  private begin(startDate: LocalDate, timeZone: string) {
    this.challenge = {
      id: null,
      courseId: this.course.id,
      startDate,
      timeZone,
      startedAt: this.now,
      completedAt: null,
      finalAttemptId: null,
      revision: 0,
    };
    this.writes.challenge = this.challenge;
  }

  private courseMismatch(): Rejection {
    return reject('COURSE_MISMATCH', `This server keeps progress for "${this.course.id}".`);
  }

  private checkStart(
    startDate: LocalDate,
    timeZone: string,
    { history }: Availability,
  ): Rejection | null {
    if (!isKnownTimeZone(timeZone)) {
      return reject('INVALID_TIME_ZONE', `"${timeZone}" is not a known time zone.`);
    }
    const ahead = diffInCalendarDays(localDateIn(timeZone, this.now), startDate);
    if (ahead > PROGRESS_SYNC.maxEarlyDays) {
      return reject('INVALID_START_DATE', 'The challenge cannot start on a day that has not come.');
    }
    if (!history && -ahead > PROGRESS_SYNC.maxLateDays) {
      return reject('INVALID_START_DATE', 'The start date is too long ago.');
    }
    return null;
  }

  /**
   * A day's quests are played on that day, in order. The server's day may
   * differ from the device's by time zones and clocks (a day early at most),
   * and play reaches it late after time offline (a week at most).
   */
  private checkAvailable(
    located: { plan: CourseDay; index: number },
    { history }: Availability,
  ): Rejection | null {
    const today = this.serverDay();
    const { day } = located.plan;
    if (day > today + PROGRESS_SYNC.maxEarlyDays) {
      return reject('QUEST_NOT_AVAILABLE', `Day ${day} has not begun (today is Day ${today}).`);
    }
    if (!history && day < today - PROGRESS_SYNC.maxLateDays) {
      return reject('QUEST_NOT_AVAILABLE', `Day ${day} is over (today is Day ${today}).`);
    }
    const before = located.plan.quests.slice(0, located.index);
    if (before.some((quest) => !this.completions.has(quest.id))) {
      return reject('QUEST_LOCKED', `The quests before it on Day ${day} are not finished.`);
    }
    return null;
  }

  /** The device's time, as metadata: never later than the server's. */
  private occurred(deviceTime: string): Date {
    const at = new Date(deviceTime);
    return at.getTime() > this.now.getTime() ? this.now : at;
  }

  private addCompletion(record: CompletionRecord, answers: QuestAnswerInput[] | null) {
    this.completions.set(record.questId, { ...record });
    this.writes.completions.push({ ...record, answers });
  }

  /** Pays a reward unless it was paid already; `true` when this call paid it. */
  private pay(reason: XpReason, refId: string, amount: number, at: Date): boolean {
    const key = `${reason}:${refId}`;
    if (this.paid.has(key)) return false;
    this.paid.add(key);
    this.writes.ledger.push({ reason, refId, amount, createdAt: at });
    return true;
  }

  /** Records the day when its last quest is finished — once. */
  private settleDay(plan: CourseDay, at: Date) {
    if (this.days.has(plan.day)) return;
    const completions = this.completionList();
    const record = buildDayCompletion({
      plan,
      completions,
      completedDays: findCompletedDays(this.course.plans, completions),
      completedAt: at.toISOString(),
    });
    if (!record) return;
    const day: DayRecord = {
      day: record.day,
      questCount: record.questCount,
      xpEarned: record.xpEarned,
      streakBefore: record.streakBefore,
      streakAfter: record.streakAfter,
      isPerfect: record.isPerfect,
      completedAt: at,
    };
    this.days.set(day.day, day);
    this.writes.days.push(day);
  }

  /** The completions in the app's shape, for its day and badge rules. */
  private completionList(): QuestCompletion[] {
    return [...this.completions.values()].map((completion) => ({
      questId: completion.questId,
      courseVersion: completion.courseVersion,
      day: completion.day,
      questType: completion.questType,
      score: completion.totalCount > 0 ? completion.correctCount / completion.totalCount : 1,
      correctCount: completion.correctCount,
      totalCount: completion.totalCount,
      xpEarned: completion.xpEarned,
      source: 'user',
      completedAt: completion.completedAt.toISOString(),
    }));
  }

  private dayList(): DayCompletion[] {
    return [...this.days.values()].map((day) => ({
      ...day,
      completedAt: day.completedAt.toISOString(),
      celebratedAt: null,
    }));
  }
}
