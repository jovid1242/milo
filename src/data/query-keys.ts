import type { DayNumber } from '@/schemas';

/** Every TanStack Query key in the app is created here. */
export const queryKeys = {
  user: ['user'] as const,

  /** The signed-in account on the Milo API: removed on logout, unlike everything local. */
  account: {
    all: ['account'] as const,
    me: ['account', 'me'] as const,
  },

  /** The course — content only, never progress; an API-backed course caches under the same keys. */
  course: {
    all: ['course'] as const,
    /** Identity, version, chapters and days. */
    outline: ['course', 'outline'] as const,
    chapters: ['course', 'chapters'] as const,
    days: ['course', 'days'] as const,
    day: (day: DayNumber) => ['course', 'day', day] as const,
    quest: (questId: string) => ['course', 'quest', questId] as const,
    questContent: (questId: string) => ['course', 'quest-content', questId] as const,
  },

  progress: {
    all: ['progress'] as const,
    state: ['progress', 'state'] as const,
    /** The Home screen's view of the current day (under `all`, so it refreshes with progress). */
    today: ['progress', 'today'] as const,
    /** A quest opened for play: content, saved session and completion. */
    questRun: (questId: string) => ['progress', 'quest-run', questId] as const,
    /** A weekly exam opened: its attempts and where it stands. */
    examRun: (questId: string) => ['progress', 'exam-run', questId] as const,
    /** One finished day's summary. */
    day: (day: DayNumber) => ['progress', 'day', day] as const,
    /** The 90-day map. */
    journey: ['progress', 'journey'] as const,
    /** The finale: the summit reached. */
    summit: ['progress', 'summit'] as const,
  },

  achievements: {
    all: ['achievements'] as const,
    list: ['achievements', 'list'] as const,
    /** Unlocks whose celebration was not shown yet. */
    pending: ['achievements', 'pending'] as const,
  },

  /** The team: it depends on the user's own progress too, so progress changes refresh it. */
  friends: {
    all: ['friends'] as const,
    /** What this device shows: the last answer, with the user's own progress. */
    team: ['friends', 'team'] as const,
    /** Asking the server (its answer replaces the last one). */
    server: ['friends', 'server'] as const,
    member: (userId: string) => ['friends', 'member', userId] as const,
    /** The team behind an invite code. */
    invite: (code: string) => ['friends', 'invite', code] as const,
  },
} as const;
