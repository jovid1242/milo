import type { Account, AuthRepository } from '@/data/repositories/types';
import { needsOnboarding } from '@/features/onboarding/use-cases';
import { logger } from '@/lib/logger';
import type { Goal, OnboardingDraft, UpdateProfileRequest, User } from '@/schemas';
import type { OwnerSession } from '@/services/session/owner-session';

export type RestoredAuth =
  { status: 'authenticated'; account: Account | null } | { status: 'unauthenticated' };

/**
 * Who is signed in at launch, from the Keychain, before the first screen. In
 * local mode the device itself is the user: always in, with no account.
 */
export async function restoreAuth(auth: AuthRepository): Promise<RestoredAuth> {
  if (auth.mode === 'local') return { status: 'authenticated', account: null };
  try {
    const account = await auth.restoreSession();
    return account ? { status: 'authenticated', account } : { status: 'unauthenticated' };
  } catch (error) {
    // The Keychain could not be read. Nothing is deleted: signing in again restores it all.
    logger.warn('the saved session could not be read', error);
    return { status: 'unauthenticated' };
  }
}

/**
 * Signing out: the account's sync stops first — nothing more is sent — then
 * the session ends here and on the server. The account's progress stays on
 * the device, its own, out of sight until the account signs in again (and
 * whatever still waits in its outbox is sent then, never as anyone else).
 */
export async function signOut(auth: AuthRepository, session: OwnerSession | null): Promise<void> {
  session?.engine?.stop();
  await auth.logout();
}

/** The name and goal onboarding just set, sent to the account. */
export async function pushProfile(auth: AuthRepository, user: User): Promise<Account | null> {
  if (auth.mode !== 'remote' || needsOnboarding(user)) return null;
  return auth.updateProfile({ displayName: user.displayName, goal: user.goal });
}

/**
 * After signing in, and at launch: an account missing the name or the goal
 * this device already has gets them — a user who took the challenge before
 * accounts existed is never asked again. What the account has is never
 * overwritten.
 */
export async function completeAccountProfile(
  auth: AuthRepository,
  user: User,
): Promise<Account | null> {
  if (auth.mode !== 'remote' || needsOnboarding(user)) return null;
  const account = await auth.fetchAccount();
  const update: UpdateProfileRequest = {};
  if (account.displayName === null) update.displayName = user.displayName;
  if (account.goal === null && user.goal !== null) update.goal = user.goal;
  return Object.keys(update).length > 0 ? auth.updateProfile(update) : account;
}

/**
 * What the account already knows, for a blank onboarding draft: signing in on
 * a new phone, onboarding starts with the name and goal filled in.
 */
export function onboardingPrefill(
  draft: Pick<OnboardingDraft, 'name' | 'goal'>,
  account: Account,
): { name?: string; goal?: Goal } {
  return {
    ...(draft.name === '' && account.displayName !== null ? { name: account.displayName } : {}),
    ...(draft.goal === null && account.goal !== null ? { goal: account.goal } : {}),
  };
}
