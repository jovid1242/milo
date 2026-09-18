import type {
  Achievement,
  AchievementId,
  AchievementUnlock,
  AnswerRecord,
  Chapter,
  DailyChallenge,
  DayNumber,
  Friend,
  LocalDate,
  QuestCompletion,
  QuestContent,
  QuestSession,
  Timestamp,
  User,
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
  /** Removes completions, their answers, sessions and quest XP. */
  deleteCompletions(questIds: readonly string[]): Promise<void>;
  getCompletionsForDays(days: readonly DayNumber[]): Promise<QuestCompletion[]>;
  resetProgress(): Promise<void>;
}

export interface AchievementRepository {
  getDefinitions(): Promise<Achievement[]>;
  getUnlocks(): Promise<AchievementUnlock[]>;
  /** Unlocks ids that are not unlocked yet; returns the ones actually added. */
  unlock(ids: readonly AchievementId[], unlockedAt: Timestamp): Promise<AchievementId[]>;
  lock(ids: readonly AchievementId[]): Promise<void>;
  resetUnlocks(): Promise<void>;
}

export interface FriendsRepository {
  getFriends(): Promise<Friend[]>;
}

/** Local-only operations used by the development tools. */
export interface DevRepository {
  /** Writes simulated history in one transaction (seeding 89 days one by one is slow). */
  seedHistory(completions: readonly QuestCompletion[], xpEvents: readonly XpEvent[]): Promise<void>;
  clearFriends(): Promise<void>;
  restoreFriends(): Promise<void>;
  resetAllLocalData(): Promise<void>;
}

export type Repositories = {
  challenge: ChallengeRepository;
  user: UserRepository;
  progress: ProgressRepository;
  achievements: AchievementRepository;
  friends: FriendsRepository;
  /** Only present for local implementations. */
  dev: DevRepository | null;
};
