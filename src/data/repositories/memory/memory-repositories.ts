import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import { generateInviteCode, normalizeInviteCode } from '@/features/friends/logic/invite-code';
import {
  AchievementSchema,
  DisplayNameSchema,
  GoalSchema,
  type AchievementId,
  type AchievementUnlock,
  type AnswerRecord,
  type ChallengeCompletion,
  type DayCompletion,
  type DayNumber,
  type LearnedWord,
  type LocalDate,
  type QuestCompletion,
  type QuestSession,
  type Team,
  type TeamActivity,
  type TeamMember,
  type Timestamp,
  type User,
  type ExamAttempt,
  type XpEvent,
  type XpEventReason,
} from '@/schemas';

import { LocalChallengeRepository } from '../local/local-challenge-repository';
import type {
  AchievementRepository,
  ChallengeStart,
  DevRepository,
  ExamRepository,
  ExamSubmissionOutcome,
  ExamSubmissionWrite,
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
  examAttempts: ExamAttempt[];
  /** The summit, once reached. */
  challenge: ChallengeCompletion | null;
  /** Keyed by `word|quest`, like the SQLite primary key. */
  words: Map<string, LearnedWord>;
  unlocks: Map<AchievementId, AchievementUnlock>;
  team: Team | null;
  members: TeamMember[];
  activity: TeamActivity[];
};

/** Quest XP and exam pass rewards are unique per ref — like the SQLite indexes. */
function isDuplicateQuestXp(events: readonly XpEvent[], event: XpEvent): boolean {
  return (
    (event.reason === 'quest' || event.reason === 'examPass') &&
    events.some((existing) => existing.reason === event.reason && existing.refId === event.refId)
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

  async getChallengeCompletion() {
    return this.store.challenge;
  }

  async markChallengeCelebrated(at: Timestamp) {
    if (!this.store.challenge || this.store.challenge.celebratedAt !== null) return false;
    this.store.challenge = { ...this.store.challenge, celebratedAt: at };
    return true;
  }

  async recordLearnedWords(words: readonly LearnedWord[]) {
    for (const word of words) {
      const key = `${word.wordId}|${word.questId}`;
      if (!this.store.words.has(key)) this.store.words.set(key, word);
    }
  }

  async countLearnedWords() {
    return new Set([...this.store.words.values()].map((word) => word.wordId)).size;
  }

  async deleteCompletions(questIds: readonly string[]) {
    const ids = new Set(questIds);
    const examIds = new Set(
      this.store.examAttempts.filter((attempt) => ids.has(attempt.questId)).map((a) => a.examId),
    );
    this.store.examAttempts = this.store.examAttempts.filter(
      (attempt) => !ids.has(attempt.questId),
    );
    this.store.xpEvents = this.store.xpEvents.filter(
      (event) => !(event.reason === 'examPass' && event.refId !== null && examIds.has(event.refId)),
    );
    for (const id of ids) {
      const completion = this.store.completions.get(id);
      if (completion?.questType === 'finalBattle') this.store.challenge = null;
      if (completion) this.store.days.delete(completion.day);
      this.store.completions.delete(id);
      this.store.sessions.delete(id);
    }
    this.store.answers = this.store.answers.filter((answer) => !ids.has(answer.questId));
    for (const [key, word] of this.store.words)
      if (ids.has(word.questId)) this.store.words.delete(key);
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
    this.store.words.clear();
    this.store.examAttempts = [];
    this.store.challenge = null;
  }
}

class MemoryExamRepository implements ExamRepository {
  constructor(private readonly store: MemoryStore) {}

  async getAttempts(examId: string) {
    return this.store.examAttempts
      .filter((attempt) => attempt.examId === examId)
      .sort((a, b) => a.number - b.number);
  }

  async getAllAttempts() {
    return [...this.store.examAttempts];
  }

  async openAttempt(attempt: ExamAttempt) {
    const open = this.store.examAttempts.find(
      (item) => item.examId === attempt.examId && item.submittedAt === null,
    );
    if (open) return open;
    this.store.examAttempts = [...this.store.examAttempts, attempt];
    return attempt;
  }

  async saveAttempt(attempt: Pick<ExamAttempt, 'id' | 'currentIndex' | 'answers' | 'updatedAt'>) {
    const stored = this.store.examAttempts.find((item) => item.id === attempt.id);
    if (!stored || stored.submittedAt !== null) return false;
    this.replace({ ...stored, ...attempt });
    return true;
  }

  async submitAttempt({
    attempt,
    completion,
    answers,
    reward,
    day,
    challenge,
  }: ExamSubmissionWrite): Promise<ExamSubmissionOutcome> {
    const stored = this.store.examAttempts.find((item) => item.id === attempt.id);
    if (!stored || stored.submittedAt !== null) {
      return {
        submitted: false,
        rewardGranted: false,
        firstCompletion: false,
        dayRecorded: false,
        challengeRecorded: false,
      };
    }
    this.replace({ ...stored, ...attempt, updatedAt: attempt.submittedAt ?? stored.updatedAt });

    const rewardGranted = reward !== null && !isDuplicateQuestXp(this.store.xpEvents, reward);
    if (reward && rewardGranted) this.store.xpEvents.push(reward);
    const earned = rewardGranted && reward ? reward.amount : 0;

    let firstCompletion = false;
    let dayRecorded = false;
    let challengeRecorded = false;
    this.store.sessions.delete(stored.questId);
    if (completion) {
      const existing = this.store.completions.get(completion.questId);
      if (existing) {
        if (earned > 0) {
          this.store.completions.set(completion.questId, {
            ...existing,
            xpEarned: existing.xpEarned + earned,
          });
        }
      } else {
        this.store.completions.set(completion.questId, { ...completion, xpEarned: earned });
        this.store.answers = [
          ...this.store.answers.filter((answer) => answer.questId !== completion.questId),
          ...answers,
        ];
        firstCompletion = true;
        if (day && !this.store.days.has(day.day)) {
          this.store.days.set(day.day, day);
          dayRecorded = true;
        }
        if (challenge && !this.store.challenge) {
          this.store.challenge = { ...challenge, xpEarned: earned };
          challengeRecorded = true;
        }
      }
    }
    return { submitted: true, rewardGranted, firstCompletion, dayRecorded, challengeRecorded };
  }

  private replace(attempt: ExamAttempt) {
    this.store.examAttempts = this.store.examAttempts.map((item) =>
      item.id === attempt.id ? attempt : item,
    );
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

  async completeOnboarding(start: ChallengeStart) {
    if (this.store.user.onboardedAt !== null) return this.store.user;
    this.store.user = {
      ...this.store.user,
      displayName: DisplayNameSchema.parse(start.displayName),
      goal: GoalSchema.parse(start.goal),
      challengeStartDate: start.challengeStartDate,
      onboardedAt: start.onboardedAt,
    };
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
    const added = [...new Set(ids)].filter((id) => !this.store.unlocks.has(id));
    for (const id of added) {
      this.store.unlocks.set(id, { achievementId: id, unlockedAt, celebratedAt: null });
    }
    return added;
  }

  async markCelebrated(ids: readonly AchievementId[], at: string) {
    const claimed: AchievementId[] = [];
    for (const id of ids) {
      const unlock = this.store.unlocks.get(id);
      if (!unlock || unlock.celebratedAt !== null) continue;
      this.store.unlocks.set(id, { ...unlock, celebratedAt: at });
      claimed.push(id);
    }
    return claimed;
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

  async getMyTeam() {
    return this.store.team;
  }

  async getTeamMembers() {
    return this.store.members;
  }

  async getMemberDetails(memberId: string) {
    return this.store.members.find((member) => member.id === memberId) ?? null;
  }

  async getTeamActivity(limit: number) {
    return [...this.store.activity]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createInvite(now: string) {
    this.store.team ??= {
      id: `team-${Date.parse(now).toString(36)}`,
      name: 'Our team',
      inviteCode: generateInviteCode(),
      createdAt: now,
    };
    const team = this.store.team;
    return { teamId: team.id, code: team.inviteCode, createdAt: team.createdAt, joinable: false };
  }

  async joinTeam(code: string) {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return { status: 'invalidCode' as const };
    if (this.store.team?.inviteCode === normalized) return { status: 'alreadyMember' as const };
    return { status: 'unavailable' as const };
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
    words: readonly LearnedWord[],
    challenge: ChallengeCompletion | null = null,
  ) {
    for (const completion of completions)
      this.store.completions.set(completion.questId, completion);
    for (const event of xpEvents) await this.progress.addXpEvent(event);
    for (const day of days) await this.progress.recordDayCompletion(day);
    await this.progress.recordLearnedWords(words);
    if (challenge && !this.store.challenge) this.store.challenge = challenge;
  }

  async replaceTeam(
    team: Team | null,
    members: readonly TeamMember[],
    activity: readonly TeamActivity[],
  ) {
    this.store.team = team;
    this.store.members = team ? [...members] : [];
    this.store.activity = team ? [...activity] : [];
  }

  async addTeamMember(member: TeamMember, activity: readonly TeamActivity[]) {
    this.store.members = [...this.store.members.filter((item) => item.id !== member.id), member];
    this.store.activity = [...this.store.activity, ...activity];
  }

  async resetOnboarding() {
    this.store.user = { ...this.store.user, onboardedAt: null, goal: null };
  }

  async resetAllLocalData() {
    await this.progress.resetProgress();
    this.store.unlocks.clear();
  }
}

/**
 * `onboarded: false` gives a brand-new profile, as on a first launch; by
 * default the user is already on the way (most domain tests start there).
 */
export function createMemoryRepositories(
  challengeStartDate: LocalDate,
  { onboarded = true }: { onboarded?: boolean } = {},
): Repositories & {
  store: MemoryStore;
} {
  const createdAt = new Date().toISOString();
  const store: MemoryStore = {
    user: {
      id: 'local-user',
      displayName: 'Explorer',
      challengeStartDate,
      createdAt,
      goal: null,
      onboardedAt: onboarded ? createdAt : null,
    },
    completions: new Map(),
    answers: [],
    sessions: new Map(),
    xpEvents: [],
    days: new Map(),
    examAttempts: [],
    challenge: null,
    words: new Map(),
    unlocks: new Map(),
    team: null,
    members: [],
    activity: [],
  };
  const progress = new MemoryProgressRepository(store);
  return {
    store,
    challenge: new LocalChallengeRepository(),
    user: new MemoryUserRepository(store),
    progress,
    achievements: new MemoryAchievementRepository(store),
    exams: new MemoryExamRepository(store),
    friends: new MemoryFriendsRepository(store),
    dev: new MemoryDevRepository(store, progress),
  };
}
