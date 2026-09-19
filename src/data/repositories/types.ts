import type {
  Achievement,
  AchievementId,
  AchievementUnlock,
  AnswerRecord,
  Chapter,
  ChallengeCompletion,
  DailyChallenge,
  DayCompletion,
  DayNumber,
  JoinTeamResult,
  LearnedWord,
  LocalDate,
  QuestCompletion,
  QuestContent,
  QuestSession,
  Team,
  TeamActivity,
  TeamInvite,
  TeamMember,
  Timestamp,
  User,
  ExamAttempt,
  XpEvent,
  XpEventReason,
} from '@/schemas';

/**
 * Data access contracts. Screens depend only on these, so a
 * `LocalChallengeRepository` can later be swapped for an `ApiChallengeRepository`
 * without touching the UI.
 */

export interface ChallengeRepository {
  getChapters(): Promise<Chapter[]>;
  getDailyChallenges(): Promise<DailyChallenge[]>;
  getDailyChallenge(day: DayNumber): Promise<DailyChallenge>;
  /** Authored lesson content; `null` while a day has no content yet. */
  getQuestContent(questId: string): Promise<QuestContent | null>;
}

export interface UserRepository {
  /** Returns the local profile, creating it on first launch. */
  getUser(): Promise<User>;
  updateDisplayName(displayName: string): Promise<User>;
  updateChallengeStartDate(date: LocalDate): Promise<User>;
}

export interface ProgressRepository {
  getCompletions(): Promise<QuestCompletion[]>;
  getTotalXp(): Promise<number>;
  /**
   * Stores a quest's first completion — the completion, its answers and its XP —
   * in one transaction, and closes its session. When the quest is already
   * completed nothing but the session changes and it returns `false`: XP is
   * awarded once per quest, whatever the caller does.
   */
  recordFirstCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
    xp: XpEvent | null,
  ): Promise<boolean>;
  /** Quests that were started but not finished. */
  getQuestSessions(): Promise<QuestSession[]>;
  saveQuestSession(session: QuestSession): Promise<void>;
  deleteQuestSession(questId: string): Promise<void>;
  addXpEvent(event: XpEvent): Promise<void>;
  /** Removes XP granted for one reason (e.g. when achievements are reset). */
  deleteXpEvents(reason: XpEventReason): Promise<void>;
  /**
   * Stores a finished day once. Returns `false` when the day was already
   * recorded — the first record stays, so a day can never complete twice.
   */
  recordDayCompletion(record: DayCompletion): Promise<boolean>;
  getDayCompletion(day: DayNumber): Promise<DayCompletion | null>;
  getDayCompletions(): Promise<DayCompletion[]>;
  /** Claims the day's celebration; only the first caller gets `true`. */
  markDayCelebrated(day: DayNumber, at: Timestamp): Promise<boolean>;
  /** Records learned words; a word already learned in that quest is ignored. */
  recordLearnedWords(words: readonly LearnedWord[]): Promise<void>;
  /** Different words learned, whichever quests taught them. */
  countLearnedWords(): Promise<number>;
  /** Removes completions, their answers, sessions, quest XP, learned words and the days they finished. */
  deleteCompletions(questIds: readonly string[]): Promise<void>;
  getCompletionsForDays(days: readonly DayNumber[]): Promise<QuestCompletion[]>;
  /** The summit, once reached (written by the Final Battle's submission). */
  getChallengeCompletion(): Promise<ChallengeCompletion | null>;
  /** Claims the summit's celebration; only the first caller gets `true`. */
  markChallengeCelebrated(at: Timestamp): Promise<boolean>;
  resetProgress(): Promise<void>;
}

export interface AchievementRepository {
  getDefinitions(): Promise<Achievement[]>;
  getUnlocks(): Promise<AchievementUnlock[]>;
  /** Unlocks ids that are not unlocked yet; returns the ones actually added. */
  unlock(ids: readonly AchievementId[], unlockedAt: Timestamp): Promise<AchievementId[]>;
  /** Marks unlocks as celebrated; returns the ones that were not yet (shown once, ever). */
  markCelebrated(ids: readonly AchievementId[], at: Timestamp): Promise<AchievementId[]>;
  lock(ids: readonly AchievementId[]): Promise<void>;
  resetUnlocks(): Promise<void>;
}

/** A submission, written in one transaction: never half-settled, whenever the app stops. */
export type ExamSubmissionWrite = {
  attempt: Pick<ExamAttempt, 'id' | 'answers' | 'submittedAt' | 'correctCount' | 'score' | 'passed'>;
  /**
   * The exam quest's completion, when this submission finishes the quest —
   * stored by the first one only. `null` when it does not (a Final Battle
   * not passed yet).
   */
  completion: QuestCompletion | null;
  answers: readonly AnswerRecord[];
  /** The pass reward: paid if this exam's reward was never paid. */
  reward: XpEvent | null;
  /** The day the completion finishes, recorded with it. */
  day: DayCompletion | null;
  /** The summit — the Final Battle's first pass finishes the challenge. */
  challenge: ChallengeCompletion | null;
};

export type ExamSubmissionOutcome = {
  /** `false` when the attempt was submitted already (a double tap): nothing changed. */
  submitted: boolean;
  rewardGranted: boolean;
  /** This submission completed the exam quest (the first one that finishes it). */
  firstCompletion: boolean;
  dayRecorded: boolean;
  challengeRecorded: boolean;
};

/** Weekly exam attempts, and the one-time reward for passing. */
export interface ExamRepository {
  /** Every attempt at an exam, the first first. */
  getAttempts(examId: string): Promise<ExamAttempt[]>;
  getAllAttempts(): Promise<ExamAttempt[]>;
  /** Opens a new attempt — unless one is open, which is then returned instead. */
  openAttempt(attempt: ExamAttempt): Promise<ExamAttempt>;
  /** Saves position and answers of an open attempt; `false` once it is submitted. */
  saveAttempt(
    attempt: Pick<ExamAttempt, 'id' | 'currentIndex' | 'answers' | 'updatedAt'>,
  ): Promise<boolean>;
  /**
   * Submits an open attempt and settles it at once: the pass reward (once per
   * exam, ever), the quest's first completion (which records the XP actually
   * paid; a later first pass adds its reward to it) with its day and — for the
   * Final Battle — the challenge, and the end of the quest's session. An
   * attempt submitted already changes nothing.
   */
  submitAttempt(submission: ExamSubmissionWrite): Promise<ExamSubmissionOutcome>;
}

/**
 * The user's team. Local today (SQLite, demo data); an `ApiFriendsRepository`
 * can replace it without touching the UI. It serves what a server would: the
 * team and the *other* members as they share themselves — the user's own
 * progress stays local and is merged in by the use cases.
 */
export interface FriendsRepository {
  /** `null` while the user is on their own. */
  getMyTeam(): Promise<Team | null>;
  /** Everyone else in the team. */
  getTeamMembers(): Promise<TeamMember[]>;
  getMemberDetails(memberId: string): Promise<TeamMember | null>;
  /** Newest first. */
  getTeamActivity(limit: number): Promise<TeamActivity[]>;
  /** The team's invite, creating the team when the user is alone. */
  createInvite(now: Timestamp): Promise<TeamInvite>;
  /** Joining someone else's team needs a server: the local build never pretends. */
  joinTeam(code: string): Promise<JoinTeamResult>;
}

/** Local-only operations used by the development tools. */
export interface DevRepository {
  /** Writes simulated history in one transaction (seeding 89 days one by one is slow). */
  seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
    days: readonly DayCompletion[],
    words: readonly LearnedWord[],
    challenge?: ChallengeCompletion | null,
  ): Promise<void>;
  /** Replaces the team (or removes it with `null`) in one transaction. */
  replaceTeam(
    team: Team | null,
    members: readonly TeamMember[],
    activity: readonly TeamActivity[],
  ): Promise<void>;
  /** A friend joining (the demo of what a server would push). */
  addTeamMember(member: TeamMember, activity: readonly TeamActivity[]): Promise<void>;
  resetAllLocalData(): Promise<void>;
}

export type Repositories = {
  challenge: ChallengeRepository;
  user: UserRepository;
  progress: ProgressRepository;
  achievements: AchievementRepository;
  exams: ExamRepository;
  friends: FriendsRepository;
  /** Only present for local implementations. */
  dev: DevRepository | null;
};
