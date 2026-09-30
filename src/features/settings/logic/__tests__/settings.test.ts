import { DEFAULT_SETTINGS, parseSettings } from '@/schemas';

import { visibleSettingsSections } from '../sections';

describe('stored preferences', () => {
  it('keep valid values', () => {
    expect(
      parseSettings({
        soundEnabled: false,
        hapticsEnabled: false,
        dailyReminderEnabled: true,
        dailyReminderTime: { hour: 8, minute: 30 },
      }),
    ).toEqual({
      soundEnabled: false,
      hapticsEnabled: false,
      dailyReminderEnabled: true,
      dailyReminderTime: { hour: 8, minute: 30 },
    });
  });

  it('recover field by field from corrupted or old data', () => {
    expect(parseSettings({ soundEnabled: 'no', hapticsEnabled: false })).toEqual({
      ...DEFAULT_SETTINGS,
      soundEnabled: true,
      hapticsEnabled: false,
    });
    expect(parseSettings({ volume: 3 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([true, false])).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings sections', () => {
  const sections = (input: Partial<Parameters<typeof visibleSettingsSections>[0]>) =>
    visibleSettingsSections({
      devBuild: false,
      account: false,
      teamNotifications: false,
      ...input,
    });

  it('never offers the developer reset outside development builds', () => {
    expect(sections({})).not.toContain('developer');
    expect(sections({ devBuild: true })).toContain('developer');
    expect(sections({})).toEqual([
      'feedback',
      'reminders',
      'motion',
      'profile',
      'challenge',
      'about',
    ]);
  });

  it('shows the account, and logging out, only when there is an account', () => {
    expect(sections({})).not.toContain('account');
    expect(sections({ account: true })[0]).toBe('account');
  });

  it('offers team notifications only with an account, on a build that can receive them', () => {
    expect(sections({ account: true, teamNotifications: true })).toEqual([
      'account',
      'feedback',
      'reminders',
      'team',
      'motion',
      'profile',
      'challenge',
      'about',
    ]);
    // Local mode: no server to send them. iOS or Expo Go: nothing to receive them.
    expect(sections({ account: false, teamNotifications: true })).not.toContain('team');
    expect(sections({ account: true, teamNotifications: false })).not.toContain('team');
  });
});
