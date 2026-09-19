import type { AchievementCategory, AchievementStatus } from '@/schemas';

export const CATEGORY_TITLES: Record<AchievementCategory, string> = {
  consistency: 'Consistency',
  learning: 'Learning',
  mastery: 'Mastery',
  together: 'Together',
};

const UNITS: Record<string, [string, string]> = {
  completedDays: ['day', 'days'],
  streak: ['day', 'days'],
  uniqueWords: ['word', 'words'],
  perfectDaysInRow: ['perfect day', 'perfect days'],
  teamStreak: ['day', 'days'],
};

const unit = (status: AchievementStatus, count: number) => {
  const [one, many] = UNITS[status.achievement.rule.type] ?? ['', ''];
  return count === 1 ? one : many;
};

/** "18 / 30 days" — only for badges with real, countable progress. */
export function progressLabel(status: AchievementStatus): string | null {
  const { progress } = status;
  if (status.state !== 'locked' || !progress) return null;
  return `${progress.current} / ${progress.target} ${unit(status, progress.target)}`;
}

/** "12 days to go" */
export function remainingLabel(status: AchievementStatus): string | null {
  const { progress } = status;
  if (status.state !== 'locked' || !progress) return null;
  const left = progress.target - progress.current;
  return left > 0 ? `${left} ${unit(status, left)} to go` : null;
}

/** The short line under a badge in the grid. */
export function statusLine(status: AchievementStatus, locale?: string): string {
  switch (status.state) {
    case 'unlocked':
      return status.unlockedAt
        ? `Unlocked · ${new Date(status.unlockedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
        : 'Unlocked';
    case 'notAvailable':
      return 'Needs a team';
    case 'locked':
      return progressLabel(status) ?? 'Locked';
  }
}

/** "Unlocked on 18 September" for the detail sheet. */
export function unlockedOn(timestamp: string, locale?: string): string {
  return `Unlocked on ${new Date(timestamp).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
