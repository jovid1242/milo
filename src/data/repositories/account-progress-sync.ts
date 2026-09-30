import type { ProgressMutationOf, ProgressMutationType } from '@/schemas';

import type { ProgressSync, SyncReason, SyncRepository } from './types';

/**
 * The `ProgressSync` of one signed-in account: makes mutations for its outbox
 * and passes "sync soon" on to whoever runs its sync (the engine, while the
 * account is in use). Nobody listening — no engine yet, or the account signed
 * out — the request is simply dropped: the outbox keeps everything anyway.
 */
export class AccountProgressSync implements ProgressSync {
  private listener: ((reason: SyncReason) => void) | null = null;

  constructor(
    readonly accountId: string,
    readonly repository: SyncRepository,
    private readonly newId: () => string,
  ) {}

  mutation<Type extends ProgressMutationType>(
    type: Type,
    payload: ProgressMutationOf<Type>['payload'],
    now: Date,
  ): ProgressMutationOf<Type> {
    return {
      id: this.newId(),
      type,
      createdAt: now.toISOString(),
      payload,
    } as ProgressMutationOf<Type>;
  }

  requestSync(reason: SyncReason): void {
    this.listener?.(reason);
  }

  /** The engine listens while it runs; the returned function stops it listening. */
  connect(listener: (reason: SyncReason) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }
}
