import type { ProgressApi } from '@/data/repositories/api/progress-api';
import type {
  MutationRejectionCode,
  MutationResult,
  ProgressMutation,
  ProgressResponse,
  ProgressSnapshot,
  QuestType,
  SyncRequest,
  SyncResponse,
} from '@/schemas';
import { ApiError } from '@/services/api/api-error';

export const emptyProgress = (): ProgressSnapshot => ({
  challenge: null,
  questCompletions: [],
  dayCompletions: [],
  learnedWords: [],
  examAttempts: [],
  xpEvents: [],
  achievementUnlocks: [],
  challengeCompletion: null,
});

type Account = {
  revision: number;
  progress: ProgressSnapshot;
  processed: Map<string, MutationResult>;
};

/** What a quest pays here: simple on purpose — the real rules are the real server's (server/test). */
export const FAKE_QUEST_XP = 30;

const dayOf = (questId: string) => Number(/^d(\d{3})-/.exec(questId)?.[1] ?? 1);
const typeOf = (questId: string) => (questId.split('-').at(-1) ?? 'vocabulary') as QuestType;

/**
 * A stand-in for the Milo API's progress endpoints in the app's tests. It keeps
 * each account's progress and answers the way the server does — revisions,
 * duplicates, refusals, the account check — applying mutations the simple way
 * (a quest pays 30 XP, once). What the server really decides is tested
 * against the server itself.
 */
export class FakeProgressServer {
  /** Every request, with the account it was signed in as. */
  readonly requests: { signedInAs: string | null; request: SyncRequest }[] = [];
  /** Quests the server refuses, and why. */
  readonly refuse = new Map<string, MutationRejectionCode>();
  offline = false;
  /** The next request fails with this. */
  failNext: ApiError | null = null;
  /** Course versions the server cannot check. */
  unsupportedVersion: number | null = null;
  private readonly accounts = new Map<string, Account>();
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;

  seed(userId: string, progress: ProgressSnapshot, revision: number): void {
    this.accounts.set(userId, { revision, progress, processed: new Map() });
  }

  progressOf(userId: string): { revision: number; progress: ProgressSnapshot } {
    const account = this.account(userId);
    return { revision: account.revision, progress: account.progress };
  }

  /** Holds every answer until `release()`: requests in flight, for single-flight tests. */
  hold(): void {
    this.gate = new Promise((resolve) => {
      this.open = resolve;
    });
  }

  release(): void {
    this.open?.();
    this.gate = null;
  }

  /** The API as a device signed in as `signedIn()` reaches it. */
  api(signedIn: () => string | null): ProgressApi {
    return {
      sync: (request) => this.sync(signedIn(), request),
      progress: async (): Promise<ProgressResponse> => {
        const user = signedIn();
        if (!user) throw new ApiError('UNAUTHORIZED', 'Sign in to continue.', 401);
        return this.progressOf(user);
      },
    };
  }

  private account(userId: string): Account {
    let account = this.accounts.get(userId);
    if (!account) {
      account = { revision: 0, progress: emptyProgress(), processed: new Map() };
      this.accounts.set(userId, account);
    }
    return account;
  }

  private async sync(signedInAs: string | null, request: SyncRequest): Promise<SyncResponse> {
    this.requests.push({ signedInAs, request });
    if (this.gate) await this.gate;
    if (this.offline) throw new ApiError('NETWORK_ERROR', 'Could not reach the server.');
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    if (!signedInAs) throw new ApiError('UNAUTHORIZED', 'Sign in to continue.', 401);
    if (request.userId !== signedInAs) {
      throw new ApiError('ACCOUNT_MISMATCH', 'These changes belong to another account.', 409);
    }
    const outdated = request.mutations.some(
      (mutation) =>
        'courseVersion' in mutation.payload &&
        mutation.payload.courseVersion === this.unsupportedVersion,
    );
    if (outdated) {
      throw new ApiError('COURSE_VERSION_UNSUPPORTED', 'Cannot check this course version.', 409);
    }
    const account = this.account(signedInAs);
    const results = request.mutations.map((mutation) => this.apply(account, mutation));
    return {
      revision: account.revision,
      results,
      progress:
        account.revision === request.knownRevision ? null : structuredClone(account.progress),
    };
  }

  private apply(account: Account, mutation: ProgressMutation): MutationResult {
    const done = account.processed.get(mutation.id);
    if (done) return { mutationId: mutation.id, status: 'duplicate' };
    const result = this.decide(account, mutation);
    account.processed.set(mutation.id, result);
    return result;
  }

  private decide(account: Account, mutation: ProgressMutation): MutationResult {
    const accepted = (changed: boolean): MutationResult => {
      if (changed) account.revision += 1;
      return { mutationId: mutation.id, status: 'accepted' };
    };
    const rejected = (code: MutationRejectionCode): MutationResult => ({
      mutationId: mutation.id,
      status: 'rejected',
      code,
      message: code,
    });
    const progress = account.progress;
    switch (mutation.type) {
      case 'startChallenge':
        if (progress.challenge) return accepted(false);
        progress.challenge = {
          courseId: mutation.payload.courseId,
          startDate: mutation.payload.startDate,
          timeZone: mutation.payload.timeZone,
          startedAt: mutation.createdAt,
          currentDay: 1,
          streak: 0,
          totalXp: 0,
          completedDays: [],
          wordsLearned: 0,
        };
        return accepted(true);
      case 'completeQuest': {
        const code = this.refuse.get(mutation.payload.questId);
        if (code) return rejected(code);
        if (!progress.challenge) return rejected('CHALLENGE_NOT_STARTED');
        return accepted(this.addQuest(progress, mutation.payload.questId, mutation.payload));
      }
      case 'submitExam':
        if (!progress.challenge) return rejected('CHALLENGE_NOT_STARTED');
        progress.examAttempts.push({
          id: mutation.payload.attemptId,
          examId: mutation.payload.questId,
          questId: mutation.payload.questId,
          courseVersion: mutation.payload.courseVersion,
          number: progress.examAttempts.length + 1,
          answers: mutation.payload.answers,
          submittedAt: mutation.payload.submittedAt,
          correctCount: mutation.payload.answers.length,
          totalCount: Math.max(1, mutation.payload.answers.length),
          score: 1,
          passed: true,
        });
        return accepted(true);
      case 'importLegacyProgress':
        if (progress.challenge) return rejected('LEGACY_IMPORT_NOT_ALLOWED');
        progress.challenge = {
          courseId: mutation.payload.courseId,
          startDate: mutation.payload.startDate,
          timeZone: mutation.payload.timeZone,
          startedAt: mutation.createdAt,
          currentDay: 1,
          streak: 0,
          totalXp: 0,
          completedDays: [],
          wordsLearned: 0,
        };
        for (const quest of mutation.payload.quests) this.addQuest(progress, quest.questId, quest);
        return accepted(true);
    }
  }

  private addQuest(
    progress: ProgressSnapshot,
    questId: string,
    played: { answers: unknown[]; completedAt: string },
  ): boolean {
    if (progress.questCompletions.some((completion) => completion.questId === questId)) {
      return false;
    }
    progress.questCompletions.push({
      questId,
      courseVersion: 1,
      day: dayOf(questId),
      questType: typeOf(questId),
      score: 1,
      correctCount: played.answers.length,
      totalCount: played.answers.length,
      xpEarned: FAKE_QUEST_XP,
      completedAt: played.completedAt,
    });
    progress.xpEvents.push({
      amount: FAKE_QUEST_XP,
      reason: 'quest',
      refId: questId,
      createdAt: played.completedAt,
    });
    if (progress.challenge) progress.challenge.totalXp += FAKE_QUEST_XP;
    return true;
  }
}
