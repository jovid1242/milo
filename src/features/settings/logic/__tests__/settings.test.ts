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
  it('never offers the developer reset outside development builds', () => {
    expect(visibleSettingsSections({ devBuild: false, account: false })).not.toContain('developer');
    expect(visibleSettingsSections({ devBuild: true, account: false })).toContain('developer');
    expect(visibleSettingsSections({ devBuild: false, account: false })).toEqual([
      'feedback',
      'reminders',
      'motion',
      'profile',
      'challenge',
      'about',
    ]);
  });

  it('shows the account, and logging out, only when there is an account', () => {
    expect(visibleSettingsSections({ devBuild: false, account: false })).not.toContain('account');
    expect(visibleSettingsSections({ devBuild: false, account: true })[0]).toBe('account');
  });
});
