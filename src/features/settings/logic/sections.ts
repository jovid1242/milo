/** Settings groups — only ones with settings that really work. */
export type SettingsSection =
  | 'account'
  | 'feedback'
  | 'reminders'
  | 'team'
  | 'motion'
  | 'profile'
  | 'challenge'
  | 'developer'
  | 'about';

/**
 * The account group (who is signed in, logging out) exists only with an
 * account — there is none in local mode. So does the team group (team
 * notifications, sent by the server), and only on a build that can receive
 * them: Android builds of Milo — not Expo Go, not iOS until its push keys are
 * set up. The developer group (dev tools, resetting the local challenge)
 * exists only in development builds: a user can never erase their progress
 * by accident.
 */
export function visibleSettingsSections({
  devBuild,
  account,
  teamNotifications,
}: {
  devBuild: boolean;
  account: boolean;
  /** This build can receive team notifications. */
  teamNotifications: boolean;
}): SettingsSection[] {
  return [
    ...(account ? (['account'] as const) : []),
    'feedback',
    'reminders',
    ...(account && teamNotifications ? (['team'] as const) : []),
    'motion',
    'profile',
    'challenge',
    ...(devBuild ? (['developer'] as const) : []),
    'about',
  ];
}
