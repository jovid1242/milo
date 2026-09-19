import type { TeamView } from '@/features/friends/logic/team';
import type { AchievementStatus, Chapter, ProgressState, User } from '@/schemas';

/**
 * Profile is a projection: everything here comes from the existing progress,
 * achievements and team state — nothing is stored twice.
 */
export type ProfileView = {
  displayName: string;
  /** Initials until a backend provides a picture. */
  avatarUrl: string | null;
  currentDay: number;
  totalDays: number;
  /** "Chapter 04 · Growth" */
  chapterLine: string;
  stats: {
    streak: number;
    totalXp: number;
    completedDays: number;
    /** Different words learned. */
    wordsLearned: number;
  };
  journey: { completedDays: number; totalDays: number; daysToSummit: number; progress: number };
  achievements: {
    unlocked: number;
    total: number;
    /** The latest unlocked badges, newest first — locked ones are not previewed. */
    recent: AchievementStatus[];
  };
  /** `null` without a team. */
  team: { members: number; teamStreak: number; finishedToday: number } | null;
};

export const RECENT_BADGES = 4;

export function buildProfileView(input: {
  user: User;
  progress: ProgressState;
  chapters: readonly Chapter[];
  achievements: readonly AchievementStatus[];
  team: TeamView | null;
  totalDays: number;
}): ProfileView {
  const { user, progress, achievements, team, totalDays } = input;
  const chapter = input.chapters.find((item) => item.id === progress.chapterId);
  const unlocked = achievements
    .filter((status) => status.state === 'unlocked' && status.unlockedAt !== null)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''));
  const completedDays = progress.completedDays.length;

  return {
    displayName: user.displayName,
    avatarUrl: null,
    currentDay: progress.currentDay,
    totalDays,
    chapterLine: chapter
      ? `Chapter ${String(chapter.number).padStart(2, '0')} · ${chapter.title}`
      : '',
    stats: {
      streak: progress.streak,
      totalXp: progress.totalXp,
      completedDays,
      wordsLearned: progress.wordsLearned,
    },
    journey: {
      completedDays,
      totalDays,
      daysToSummit: Math.max(0, totalDays - progress.currentDay),
      progress: completedDays / totalDays,
    },
    achievements: {
      unlocked: unlocked.length,
      total: achievements.length,
      recent: unlocked.slice(0, RECENT_BADGES),
    },
    team: team
      ? {
          members: team.members.length,
          teamStreak: team.teamStreak,
          finishedToday: team.finishedToday,
        }
      : null,
  };
}
