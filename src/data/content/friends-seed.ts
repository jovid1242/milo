import type { Friend } from '@/schemas';

type FriendSeed = Omit<Friend, 'lastActiveAt'> & { lastActiveMinutesAgo: number };

/**
 * Mock team used until a backend exists. Stored in SQLite on first launch so it
 * behaves like cached server data (and dev tools can empty/restore it).
 */
export const FRIENDS_SEED: readonly FriendSeed[] = [
  {
    id: 'friend-aziz',
    displayName: 'Aziz',
    currentDay: 1,
    streak: 1,
    totalXp: 120,
    completedToday: true,
    lastActiveMinutesAgo: 25,
  },
  {
    id: 'friend-madina',
    displayName: 'Madina',
    currentDay: 1,
    streak: 1,
    totalXp: 105,
    completedToday: true,
    lastActiveMinutesAgo: 90,
  },
  {
    id: 'friend-timur',
    displayName: 'Timur',
    currentDay: 1,
    streak: 0,
    totalXp: 40,
    completedToday: false,
    lastActiveMinutesAgo: 300,
  },
  {
    id: 'friend-sofia',
    displayName: 'Sofia',
    currentDay: 1,
    streak: 1,
    totalXp: 95,
    completedToday: false,
    lastActiveMinutesAgo: 45,
  },
];
