import { DEFAULT_SETTINGS, parseSettings } from '@/schemas';

import { visibleSettingsSections } from '../sections';

describe('stored preferences', () => {
  it('keep valid values', () => {
    expect(parseSettings({ soundEnabled: false, hapticsEnabled: false })).toEqual({
      soundEnabled: false,
      hapticsEnabled: false,
    });
  });

  it('recover field by field from corrupted or old data', () => {
    expect(parseSettings({ soundEnabled: 'no', hapticsEnabled: false })).toEqual({
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
    expect(visibleSettingsSections(false)).not.toContain('developer');
    expect(visibleSettingsSections(true)).toContain('developer');
    expect(visibleSettingsSections(false)).toEqual([
      'feedback',
      'motion',
      'profile',
      'challenge',
      'about',
    ]);
  });
});
