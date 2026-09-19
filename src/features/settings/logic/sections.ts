/** Settings groups — only ones with settings that really work. */
export type SettingsSection =
  'feedback' | 'motion' | 'profile' | 'challenge' | 'developer' | 'about';

/**
 * The developer group (dev tools, resetting the local challenge) exists only
 * in development builds: a user can never erase their progress by accident.
 */
export function visibleSettingsSections(isDevBuild: boolean): SettingsSection[] {
  return [
    'feedback',
    'motion',
    'profile',
    'challenge',
    ...(isDevBuild ? (['developer'] as const) : []),
    'about',
  ];
}
