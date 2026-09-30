import { NodeSqliteStore } from '@/data/db/__fixtures__/node-sqlite-store';
import type { TeamApi } from '@/data/repositories/api/team-api';
import { LocalAuthRepository } from '@/data/repositories/local/local-auth-repository';
import { LocalCourseRepository } from '@/data/repositories/local/local-course-repository';
import { LOCAL_OWNER, type DeviceServices } from '@/data/repositories/owner-repositories';
import type { Account, Repositories } from '@/data/repositories/types';
import { scorableExercises } from '@/features/progress/logic/quest-scoring';
import { completeQuest } from '@/features/progress/use-cases';
import type { AnswerRecord } from '@/schemas';
import {
  openOwnerSession,
  type OwnerSession,
  type SyncPlatform,
} from '@/services/session/owner-session';

import type { FakeProgressServer } from './fake-progress-server';

export const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const accountDto = (id: string, displayName: string | null = null): Account => ({
  id,
  email: `${id.slice(0, 4)}@example.com`,
  displayName,
  goal: null,
  createdAt: '2026-09-01T08:00:00.000Z',
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A cache that only counts being cleared (React Query's client in the app). */
export class CountingCache {
  cleared = 0;
  clear() {
    this.cleared += 1;
  }
}

/**
 * A phone for the app's tests: the app's own SQLite schema, repositories,
 * sessions and sync on Node's SQLite, talking to a server — the fake one here,
 * the real one in the server's tests. A file path lets it "restart".
 */
export class TestDevice {
  /** Who the session on this phone belongs to (the Keychain). */
  signedIn: string | null = null;
  online = true;
  readonly store: NodeSqliteStore;
  readonly services: DeviceServices;
  private ids = 0;

  constructor(
    readonly server: {
      api: FakeProgressServer['api'];
      /** Teams too, when the test has a team server. */
      teamApi?: (signedIn: () => string | null) => TeamApi;
    },
    path = ':memory:',
    id = 0,
  ) {
    this.ids = id;
    this.store = new NodeSqliteStore(path);
    this.services = {
      auth: new LocalAuthRepository(),
      course: new LocalCourseRepository(),
      courseUpdates: null,
      progressApi: server.api(() => this.signedIn),
      teamApi: server.teamApi?.(() => this.signedIn) ?? null,
      pushApi: null,
      currentAccountId: () => this.signedIn,
      store: this.store,
      newId: () => uuid((this.ids += 1)),
    };
  }

  readonly platform: SyncPlatform = {
    isOnline: () => this.online,
    subscribe: () => () => undefined,
  };

  private readonly sessions: OwnerSession<CountingCache>[] = [];

  /**
   * Opens an account's progress as the app does after signing in — or, with
   * `null`, the device's own. `autoSync: false` leaves syncing to the test:
   * storing a mutation then does not start one by itself.
   */
  async open(
    account: string | null,
    { autoSync = false }: { autoSync?: boolean } = {},
  ): Promise<OwnerSession<CountingCache>> {
    this.signedIn = account;
    const session = await openOwnerSession({
      device: this.services,
      owner: account ?? LOCAL_OWNER,
      account: account ? accountDto(account) : null,
      queryClient: new CountingCache(),
      platform: this.platform,
      onChanged: () => undefined,
    });
    if (!autoSync) session.repositories.sync?.connect(() => undefined);
    this.sessions.push(session);
    return session;
  }

  /** The app going away: every session stopped, the database closed. */
  async close(): Promise<void> {
    for (const session of this.sessions) session.dispose();
    await this.store.close();
  }
}

/** Plays a daily quest of the real course, every answer right (or the first `wrong` wrong). */
export async function playQuest(
  repositories: Repositories,
  questId: string,
  { now = new Date(), wrong = 0 }: { now?: Date; wrong?: number } = {},
) {
  const content = await repositories.course.getQuestContent(questId);
  const exercises = content ? scorableExercises(content) : null;
  if (!exercises) throw new Error(`${questId} is not playable`);
  const answers: AnswerRecord[] = exercises.map((exercise, index) => {
    const optionId =
      index < wrong
        ? (exercise.optionIds.find((id) => id !== exercise.correctOptionId) ?? '')
        : exercise.correctOptionId;
    return {
      questId,
      questionId: exercise.id,
      answer: { kind: 'singleChoice', optionId },
      isCorrect: optionId === exercise.correctOptionId,
      answeredAt: now.toISOString(),
    };
  });
  return completeQuest(repositories, {
    questId,
    correctCount: answers.filter((answer) => answer.isCorrect).length,
    totalCount: answers.length,
    answers,
    now,
  });
}
