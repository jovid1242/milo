import type { ThemeFamily } from '@/schemas';

/**
 * Theme families. A day's theme belongs to one; families come back through
 * the course in harder contexts (work: a day at work → rules → teamwork → a
 * job interview), and no two lesson days in a row share one.
 */
const FAMILIES = [
  { id: 'learning', title: 'Learning & progress' },
  { id: 'routine', title: 'Daily routine & time' },
  { id: 'self', title: 'Me & who I am' },
  { id: 'home', title: 'Home & everyday actions' },
  { id: 'relationships', title: 'Family, friends & relationships' },
  { id: 'city', title: 'Town, city & places' },
  { id: 'communication', title: 'Communication' },
  { id: 'work', title: 'Work & study' },
  { id: 'food', title: 'Food & eating' },
  { id: 'shopping', title: 'Shopping' },
  { id: 'money', title: 'Money' },
  { id: 'travel', title: 'Travel & transport' },
  { id: 'health', title: 'Health & wellbeing' },
  { id: 'free-time', title: 'Free time' },
  { id: 'nature', title: 'Weather & nature' },
  { id: 'experience', title: 'Experiences & memories' },
  { id: 'problems', title: 'Problems & solutions' },
  { id: 'future', title: 'Plans, goals & the future' },
  { id: 'decisions', title: 'Choices & decisions' },
  { id: 'technology', title: 'Technology' },
  { id: 'culture', title: 'Culture & society' },
  { id: 'challenges', title: 'Challenges & pressure' },
  { id: 'success', title: 'Success & failure' },
  { id: 'growth', title: 'Personal growth & confidence' },
  { id: 'habits', title: 'Habits & lifestyle' },
  { id: 'real-life', title: 'Real-life situations' },
] as const;

export type ThemeFamilyId = (typeof FAMILIES)[number]['id'];

export const THEME_FAMILIES: ThemeFamily[] = FAMILIES.map((family) => ({ ...family }));
