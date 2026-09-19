import type { DayNumber } from '@/schemas';

/** Every TanStack Query key in the app is created here. */
export const queryKeys = {
  user: ['user'] as const,

  challenge: {
    all: ['challenge'] as const,
    chapters: ['challenge', 'chapters'] as const,
    days: ['challenge', 'days'] as const,
    day: (day: DayNumber) => ['challenge', 'day', day] as const,
    quest: (questId: string) => ['challenge', 'quest', questId] as const,
    questContent: (questId: string) => ['challenge', 'quest-content', questId] as const,
  },

  progress: {
    all: ['progress'] as const,
    state: ['progress', 'state'] as const,
    /** The Home screen's view of the current day (under `all`, so it refreshes with progress). */
    today: ['progress', 'today'] as const,
    /** A quest opened for play: content, saved session and completion. */
    questRun: (questId: string) => ['progress', 'quest-run', questId] as const,
    /** One finished day's summary. */
    day: (day: DayNumber) => ['progress', 'day', day] as const,
  },

  achievements: {
    all: ['achievements'] as const,
    list: ['achievements', 'list'] as const,
  },

  friends: {
    all: ['friends'] as const,
    list: ['friends', 'list'] as const,
  },
} as const;
