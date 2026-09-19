import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import { FRIENDS_SEED } from '@/data/content/friends-seed';
import {
  AchievementSchema,
  type AchievementId,
  type AchievementUnlock,
  type AnswerRecord,
  type DayCompletion,
  type DayNumber,
  type Friend,
  type LocalDate,
  type QuestCompletion,
  type QuestSession,
  type Timestamp,
  type User,
  type XpEvent,
  type XpEventReason,
} from '@/schemas';

import { LocalChallengeRepository } from '../local/local-challenge-repository';
import type {
  AchievementRepository,
  DevRepository,
  FriendsRepository,
  ProgressRepository,
  Repositories,
  UserRepository,
} from '../types';

/**
 * In-memory repositories with the same contract as the SQLite ones — used by
 * domain tests, which cannot open a native database. Keep the semantics in step
 * with `local/`: first completion only, one quest XP event per quest,
 * one record and one celebration per day.
 */
export type MemoryStore = {
  user: User;
  completions: Map<string, QuestCompletion>;
  answers: AnswerRecord[];
  sessions: Map<string, QuestSession>;
  xpEvents: XpEvent[];
  days: Map<DayNumber, DayCompletion>;
  unlocks: Map<AchievementId, AchievementUnlock>;
  friends: Friend[];
};

function isDuplicateQuestXp(events: readonly XpEvent[], event: XpEvent): boolean {
  return (
    event.reason === 'quest' &&
    events.some((existing) => existing.reason === 'quest' && existing.refId === event.refId)
  );
}

class MemoryProgressRepository implements ProgressRepository {
  constructor(private readonly store: MemoryStore) {}

  async getCompletions() {
    return [...this.store.completions.values()].sort((a, b) => a.day - b.day);
  }

  async getCompletionsForDays(days: readonly DayNumber[]) {
    return (await this.getCompletions()).filter((completion) => days.includes(completion.day));
  }

  async getTotalXp() {
    return this.store.xpEvents.reduce((sum, event) => sum + event.amount, 0);
  }

  async recordFirstCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
    xp: XpEvent | null,
  ) {
    this.store.sessions.delete(completion.questId);
    if (this.store.completions.has(completion.questId)) return false;
    this.store.completions.set(completion.questId, completion);
    this.store.answers = [
      ...this.store.answers.filter((answer) => answer.questId !== completion.questId),
      ...answers,
    ];
    if (xp) await this.addXpEvent(xp);
    return true;
  }

  async getQuestSessions() {
    return [...this.store.sessions.values()];
  }

  async saveQuestSession(session: QuestSession) {
    const existing = this.store.sessions.get(session.questId);
    this.store.sessions.set(session.questId, {
      ...session,
      startedAt: existing?.startedAt ?? session.startedAt,
    });
  }

  async deleteQuestSession(questId: string) {
    this.store.sessions.delete(questId);
  }

  async addXpEvent(event: XpEvent) {
    if (!isDuplicateQuestXp(this.store.xpEvents, event)) this.store.xpEvents.push(event);
  }

  async deleteXpEvents(reason: XpEventReason) {
    this.store.xpEvents = this.store.xpEvents.filter((event) => event.reason !== reason);
  }

  async recordDayCompletion(record: DayCompletion) {
    if (this.store.days.has(record.day)) return false;
    this.store.days.set(record.day, record);
    return true;
  }

  async getDayCompletion(day: DayNumber) {
    return this.store.days.get(day) ?? null;
  }

  async getDayCompletions() {
    return [...this.store.days.values()].sort((a, b) => a.day - b.day);
  }

  async markDayCelebrated(day: DayNumber, at: Timestamp) {
    const record = this.store.days.get(day);
    if (!record || record.celebratedAt !== null) return false;
    this.store.days.set(day, { ...record, celebratedAt: at });
    return true;
  }

  async deleteCompletions(questIds: readonly string[]) {
    const ids = new Set(questIds);
    for (const id of ids) {
      const completion = this.store.completions.get(id);
      if (completion) this.store.days.delete(completion.day);
      this.store.completions.delete(id);
      this.store.sessions.delete(id);
    }
    this.store.answers = this.store.answers.filter((answer) => !ids.has(answer.questId));
    this.store.xpEvents = this.store.xpEvents.filter(
      (event) => !(event.reason === 'quest' && event.refId !== null && ids.has(event.refId)),
    );
  }

  async resetProgress() {
    this.store.completions.clear();
    this.store.sessions.clear();
    this.store.answers = [];
    this.store.xpEvents = [];
    this.store.days.clear();
  }
}

class MemoryUserRepository implements UserRepository {
  constructor(private readonly store: MemoryStore) {}

  async getUser() {
    return this.store.user;
  }

  async updateDisplayName(displayName: string) {
    this.store.user = { ...this.store.user, displayName };
    return this.store.user;
  }

  async updateChallengeStartDate(date: LocalDate) {
    this.store.user = { ...this.store.user, challengeStartDate: date };
    return this.store.user;
  }
}

class MemoryAchievementRepository implements AchievementRepository {
  constructor(private readonly store: MemoryStore) {}

  async getDefinitions() {
    return z.array(AchievementSchema).parse(ACHIEVEMENTS);
  }

  async getUnlocks() {
    return [...this.store.unlocks.values()];
  }

  async unlock(ids: readonly AchievementId[], unlockedAt: string) {
    const added = ids.filter((id) => !this.store.unlocks.has(id));
    for (const id of added) this.store.unlocks.set(id, { achievementId: id, unlockedAt });
    return added;
  }

  async lock(ids: readonly AchievementId[]) {
    for (const id of ids) this.store.unlocks.delete(id);
  }

  async resetUnlocks() {
    this.store.unlocks.clear();
  }
}

class MemoryFriendsRepository implements FriendsRepository {
  constructor(private readonly store: MemoryStore) {}

  async getFriends() {
    return this.store.friends;
  }
}

class MemoryDevRepository implements DevRepository {
  constructor(
    private readonly store: MemoryStore,
    private readonly progress: MemoryProgressRepository,
  ) {}

  async seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
    days: readonly DayCompletion[],
  ) {
    for (const completion of completions)
      this.store.completions.set(completion.questId, completion);
    for (const event of xpEvents) await this.progress.addXpEvent(event);
    for (const day of days) await this.progress.recordDayCompletion(day);
  }

  async clearFriends() {
    this.store.friends = [];
  }

  async restoreFriends() {
    this.store.friends = seedFriends();
  }

  async resetAllLocalData() {
    await this.progress.resetProgress();
    this.store.unlocks.clear();
  }
}

function seedFriends(): Friend[] {
  return FRIENDS_SEED.map(({ lastActiveMinutesAgo, ...friend }) => ({
    ...friend,
    lastActiveAt: new Date(Date.now() - lastActiveMinutesAgo * 60_000).toISOString(),
  }));
}

export function createMemoryRepositories(challengeStartDate: LocalDate): Repositories & {
  store: MemoryStore;
} {
  const store: MemoryStore = {
    user: {
      id: 'local-user',
      displayName: 'Explorer',
      challengeStartDate,
      createdAt: new Date().toISOString(),
    },
    completions: new Map(),
    answers: [],
    sessions: new Map(),
    xpEvents: [],
    days: new Map(),
    unlocks: new Map(),
    friends: seedFriends(),
  };
  const progress = new MemoryProgressRepository(store);
  return {
    store,
    challenge: new LocalChallengeRepository(),
    user: new MemoryUserRepository(store),
    progress,
    achievements: new MemoryAchievementRepository(store),
    friends: new MemoryFriendsRepository(store),
    dev: new MemoryDevRepository(store, progress),
  };
}
