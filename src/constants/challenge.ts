/**
 * Rules of the challenge the app runs. What each day holds — its kind, its
 * quests, exams and their pass marks — is the course's (`content/course`); the
 * course validator checks that the course is `totalDays` long.
 */
export const CHALLENGE = {
  totalDays: 90,
  perfectScoreBonusXp: 10,
} as const;

/** App-level storage identifiers. Changing them orphans existing local data. */
export const STORAGE = {
  databaseName: 'milo.db',
  settingsKey: 'milo.settings',
  /** Onboarding answers before the profile exists; dropped once it is done. */
  onboardingKey: 'milo.onboarding',
} as const;
