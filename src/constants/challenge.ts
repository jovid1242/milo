/** Rules of the 90-day challenge. Content decisions live in `data/content`. */
export const CHALLENGE = {
  totalDays: 90,
  /** A weekly exam replaces the regular quest set every 7th day (7, 14, …, 84). */
  weeklyExamInterval: 7,
  examPassingScore: 0.7,
  perfectScoreBonusXp: 10,
  wordsPerVocabularyQuest: 6,
} as const;

/** App-level storage identifiers. Changing them orphans existing local data. */
export const STORAGE = {
  databaseName: 'milo.db',
  settingsKey: 'milo.settings',
  /** Onboarding answers before the profile exists; dropped once it is done. */
  onboardingKey: 'milo.onboarding',
} as const;
