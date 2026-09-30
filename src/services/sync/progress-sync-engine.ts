import type { ProgressApi } from '@/data/repositories/api/progress-api';
import type { SyncReason, SyncRepository } from '@/data/repositories/types';
import { logger } from '@/lib/logger';
import { PROGRESS_SYNC, type Timestamp } from '@/schemas';
import { ApiError } from '@/services/api/api-error';

/**
 * Where an account's sync stands — for the development tools and the
 * "saved on this device" notice.
 *
 * - `idle`: nothing is waiting, or the last sync went through;
 * - `syncing`: a request is on its way;
 * - `offline`: no connection — everything stays in the outbox until there is one;
 * - `error`: the server could not take it now; retried with backoff;
 * - `blocked`: the server cannot check this course version — the outbox waits, whole;
 * - `stopped`: the account is not the one signed in any more.
 */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'blocked' | 'stopped';

export type SyncStatus = {
  owner: string;
  state: SyncState;
  pending: number;
  rejected: number;
  /** The server revision the device's copy reflects. */
  revision: number;
  lastSyncedAt: Timestamp | null;
  lastAttemptAt: Timestamp | null;
  /** Why it is not `idle`, in a few words (never shown to learners as is). */
  error: string | null;
};

type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type ProgressSyncEngineOptions = {
  /** The account this engine syncs — and the only one it ever will. */
  owner: string;
  repository: SyncRepository;
  api: ProgressApi;
  /** The course the device uses now. */
  course: () => Promise<{ id: string; version: number }>;
  /** The account the session on this device belongs to right now. */
  currentAccountId: () => string | null;
  /** Something the screens show changed. */
  onChanged: () => void;
  onStatus?: (status: SyncStatus) => void;
  isOnline?: () => boolean;
  now?: () => Date;
  random?: () => number;
  timers?: Timers;
};

export const BACKOFF = { baseMs: 2_000, maxMs: 5 * 60_000 } as const;
/** Requests one run may make: a long outbox, then a pull — never an endless loop. */
const MAX_ROUNDS = 20;

const describe = (error: unknown) =>
  error instanceof ApiError ? `${error.code}: ${error.message}` : String(error);

/**
 * Sends one account's outbox to the server and applies its answers. One run
 * at a time (single-flight): a request for a sync during a run makes one more
 * run after it, never a second at once. There is no polling: it runs when
 * asked — the account is opened, a mutation was stored, the app comes back to
 * the foreground or online, or someone taps "Sync now" — and after a failure,
 * again with a growing delay (2 s … 5 min). A refused mutation is not
 * retried: the server's answer is final.
 */
export class ProgressSyncEngine {
  private running: Promise<void> | null = null;
  /** The run after the current one, promised to whoever asked during it. */
  private next: Promise<void> | null = null;
  private again = false;
  private stopped = false;
  private failures = 0;
  private retry: unknown = null;
  private controller: AbortController | null = null;
  private batchLimit: number = PROGRESS_SYNC.batchLimit;
  private status: SyncStatus;
  private readonly now: () => Date;
  private readonly timers: Timers;

  constructor(private readonly options: ProgressSyncEngineOptions) {
    this.now = options.now ?? (() => new Date());
    this.timers = options.timers ?? {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.status = {
      owner: options.owner,
      state: 'idle',
      pending: 0,
      rejected: 0,
      revision: 0,
      lastSyncedAt: null,
      lastAttemptAt: null,
      error: null,
    };
  }

  get owner(): string {
    return this.options.owner;
  }

  current(): SyncStatus {
    return this.status;
  }

  /**
   * Syncs now — or, while a run is going, once more right after it (the
   * promise then settles when that next run has). Never throws: failures
   * are the status's to tell.
   */
  requestSync(reason: SyncReason): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      this.next ??= this.running.then(() => this.running ?? undefined);
      return this.next;
    }
    return this.start(reason, { pull: true });
  }

  /**
   * One run. `pull`: ask the server even with nothing to send (to hear about
   * other devices); the run made for changes that came in during the last one
   * only sends what waits.
   */
  private start(reason: SyncReason, { pull }: { pull: boolean }): Promise<void> {
    this.clearRetry();
    this.next = null;
    const run = this.run(reason, pull).finally(() => {
      this.running = null;
      if (this.again && !this.stopped) {
        this.again = false;
        void this.start('mutation', { pull: false });
      }
    });
    this.running = run;
    return run;
  }

  /** Stops for good: the request on its way is cancelled, nothing runs again. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.clearRetry();
    this.controller?.abort();
    this.update({ state: 'stopped', error: null });
  }

  /** Reads the outbox and the revision into the status (at start, and after changes). */
  async refresh(): Promise<void> {
    const [counts, state] = await Promise.all([
      this.options.repository.counts(),
      this.options.repository.state(),
    ]);
    this.update({ ...counts, revision: state.revision, lastSyncedAt: state.syncedAt });
  }

  private async run(reason: SyncReason, pullFirst: boolean): Promise<void> {
    const { repository, api } = this.options;
    if (this.options.isOnline && !this.options.isOnline()) {
      // Offline: nothing is lost, and nothing is tried until the connection is back.
      await this.refresh();
      this.update({ state: 'offline', error: null });
      return;
    }
    this.update({ state: 'syncing', lastAttemptAt: this.now().toISOString() });
    let batch: string[] = [];
    try {
      let pull = pullFirst;
      for (let round = 0; round < MAX_ROUNDS && !this.stopped; round++) {
        if (this.options.currentAccountId() !== this.owner) {
          // Signed out, or someone else signed in: this outbox is not theirs to send.
          this.stop();
          return;
        }
        const mutations = await repository.pending(this.batchLimit);
        if (mutations.length === 0 && !pull) break;
        const [state, course] = await Promise.all([repository.state(), this.options.course()]);
        batch = mutations.map((mutation) => mutation.id);
        await repository.markAttempt(batch, this.now().toISOString());

        this.controller = new AbortController();
        const response = await api.sync(
          {
            userId: this.owner,
            courseId: course.id,
            courseVersion: course.version,
            knownRevision: state.revision,
            mutations,
          },
          this.controller.signal,
        );
        this.controller = null;
        // Applied even if the account signed out meanwhile: it is this account's own copy.
        const applied = await repository.apply(response, this.now().toISOString());
        this.failures = 0;
        this.batchLimit = PROGRESS_SYNC.batchLimit;
        const rejected = response.results.filter((result) => result.status === 'rejected');
        if (rejected.length > 0) {
          logger.warn(
            `progress sync: ${rejected.length} change(s) refused by the server`,
            rejected.map((result) => result.code),
          );
        }
        if (applied.changed && !this.stopped) this.options.onChanged();
        // A refusal can leave an optimistic change on a confirmed row: the next
        // round asks for the whole progress to put it right.
        if (rejected.length > 0 && response.progress === null) {
          await repository.apply(
            await api.sync({
              userId: this.owner,
              courseId: course.id,
              courseVersion: course.version,
              knownRevision: 0,
              mutations: [],
            }),
            this.now().toISOString(),
          );
          if (!this.stopped) this.options.onChanged();
        }
        pull = false;
        if (mutations.length === 0) break;
      }
      await this.refresh();
      this.update({ state: 'idle', error: null });
      logger.debug(`progress sync (${reason}): revision ${this.status.revision}`);
    } catch (error) {
      this.controller = null;
      await this.failed(error, batch);
    }
  }

  private async failed(error: unknown, batch: readonly string[]) {
    if (this.stopped) return;
    await this.refresh().catch(() => undefined);
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'COURSE_VERSION_UNSUPPORTED':
        case 'COURSE_MISMATCH':
          // Nothing was applied; the outbox waits, whole and in order, for a
          // server that can check it (tried again on the next occasion, not in a loop).
          this.update({ state: 'blocked', error: describe(error) });
          return;
        case 'ACCOUNT_MISMATCH':
        case 'UNAUTHORIZED':
          this.stop();
          return;
        case 'VALIDATION_ERROR':
          // The server cannot read the request: find the change it cannot
          // read, one at a time, and set it aside — the rest goes on.
          if (batch.length === 1 && batch[0]) {
            await this.options.repository.rejectLocally(
              batch[0],
              'INVALID_MUTATION',
              error.message,
            );
            this.options.onChanged();
          } else if (batch.length > 1) {
            this.batchLimit = 1;
          } else {
            break;
          }
          this.update({ state: 'error', error: describe(error) });
          this.schedule(0);
          return;
        case 'NETWORK_ERROR':
        case 'TIMEOUT':
          this.update({ state: 'offline', error: describe(error) });
          this.scheduleBackoff();
          return;
      }
    }
    logger.warn('progress sync failed', describe(error));
    this.update({ state: 'error', error: describe(error) });
    this.scheduleBackoff();
  }

  private scheduleBackoff() {
    this.failures += 1;
    const delay = Math.min(BACKOFF.maxMs, BACKOFF.baseMs * 2 ** (this.failures - 1));
    const jitter = 0.8 + 0.4 * (this.options.random ?? Math.random)();
    this.schedule(Math.round(delay * jitter));
  }

  private schedule(ms: number) {
    this.clearRetry();
    this.retry = this.timers.setTimeout(() => {
      this.retry = null;
      void this.requestSync('retry');
    }, ms);
  }

  private clearRetry() {
    if (this.retry !== null) this.timers.clearTimeout(this.retry);
    this.retry = null;
  }

  private update(change: Partial<SyncStatus>) {
    this.status = { ...this.status, ...change };
    this.options.onStatus?.(this.status);
  }
}
