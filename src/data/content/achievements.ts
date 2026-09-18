import type { Achievement } from '@/schemas';

/** Rules behind each badge. Ids match badge assets; titles match badge lettering. */
export const ACHIEVEMENTS = [
  {
    id: 'firstDay',
    title: 'First Day',
    description: 'Complete your first challenge day.',
    xpReward: 25,
    criteria: { type: 'completedDays', count: 1 },
  },
  {
    id: 'days3',
    title: '3 Days',
    description: 'Consistent steps: complete 3 days.',
    xpReward: 30,
    criteria: { type: 'completedDays', count: 3 },
  },
  {
    id: 'days7',
    title: '7 Days',
    description: 'Building habits: complete 7 days.',
    xpReward: 50,
    criteria: { type: 'completedDays', count: 7 },
  },
  {
    id: 'days14',
    title: '14 Days',
    description: 'Stronger habits: complete 14 days.',
    xpReward: 75,
    criteria: { type: 'completedDays', count: 14 },
  },
  {
    id: 'days30',
    title: '30 Days',
    description: 'Great progress: complete 30 days.',
    xpReward: 100,
    criteria: { type: 'completedDays', count: 30 },
  },
  {
    id: 'days50',
    title: '50 Days',
    description: 'Halfway hero: complete 50 days.',
    xpReward: 150,
    criteria: { type: 'completedDays', count: 50 },
  },
  {
    id: 'days90',
    title: '90 Days',
    description: 'You did it: complete all 90 days.',
    xpReward: 500,
    criteria: { type: 'completedDays', count: 90 },
  },
  {
    id: 'words100',
    title: '100 Words',
    description: 'Knowledge grows: learn 100 words.',
    xpReward: 75,
    criteria: { type: 'wordsLearned', count: 100 },
  },
  {
    id: 'words500',
    title: '500 Words',
    description: 'Keep going: learn 500 words.',
    xpReward: 200,
    criteria: { type: 'wordsLearned', count: 500 },
  },
  {
    id: 'perfectQuiz',
    title: 'Perfect Quiz',
    description: 'All correct: finish a quiz without a mistake.',
    xpReward: 40,
    criteria: { type: 'perfectQuiz' },
  },
  {
    id: 'perfectWeek',
    title: 'Perfect Week',
    description: 'Seven days in a row without a break.',
    xpReward: 100,
    criteria: { type: 'streak', count: 7 },
  },
  {
    id: 'teamStreak',
    title: 'Team Streak',
    description: 'Learning is better together: the whole team keeps a 7-day streak.',
    xpReward: 100,
    criteria: { type: 'teamStreak', count: 7 },
  },
] as const satisfies readonly Achievement[];
