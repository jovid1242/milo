/** Settings groups — only ones with settings that really work. */
export type SettingsSection =
  'account' | 'feedback' | 'reminders' | 'motion' | 'profile' | 'challenge' | 'developer' | 'about';

/**
 * The account group (who is signed in, logging out) exists only with an
 * account — there is none in local mode. The developer group (dev tools,
 * resetting the local challenge) exists only in development builds: a user
 * can never erase their progress by accident.
 */
export function visibleSettingsSections({
  devBuild,
  account,
}: {
  devBuild: boolean;
  account: boolean;
}): SettingsSection[] {
  return [
    ...(account ? (['account'] as const) : []),
    'feedback',
    'reminders',
    'motion',
    'profile',
    'challenge',
    ...(devBuild ? (['developer'] as const) : []),
    'about',
  ];
}
