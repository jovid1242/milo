import { inviteGate, parsePendingInvite, pendingInvite } from '../pending-invite';

const NOW = new Date('2026-09-30T10:00:00.000Z');

describe('an invite opened before the app can show it', () => {
  it('waits for an account, then for the challenge, then shows the team', () => {
    expect(inviteGate({ signedIn: false, onboarded: false })).toBe('signIn');
    expect(inviteGate({ signedIn: true, onboarded: false })).toBe('onboarding');
    expect(inviteGate({ signedIn: true, onboarded: true })).toBe('preview');
  });

  it('is kept as it was opened', () => {
    const kept = pendingInvite('7K2PX-9QDMA', NOW);
    expect(parsePendingInvite(JSON.stringify(kept), NOW)).toEqual(kept);
  });

  it('is dropped once no invite could still work, or when unreadable', () => {
    const old = pendingInvite('7K2PX-9QDMA', new Date('2026-09-22T10:00:00.000Z'));
    expect(parsePendingInvite(JSON.stringify(old), NOW)).toBeNull();
    for (const raw of [
      null,
      '',
      'not json',
      '{"code":"nope","savedAt":"2026-09-30T09:00:00.000Z"}',
    ]) {
      expect(parsePendingInvite(raw, NOW)).toBeNull();
    }
  });
});
