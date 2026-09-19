import { CHALLENGE } from '@/constants/challenge';
import { useAchievements } from '@/features/achievements/queries';
import { useChapters } from '@/features/challenge/queries';
import { useTeam } from '@/features/friends/queries';
import { useProgressState } from '@/features/progress/queries';

import { buildProfileView } from '../logic/profile-view';
import { useUser } from '../queries';

/**
 * The Profile, selected from the queries other screens already use — no own
 * fetch, no copy: when progress, badges or the team change, it follows.
 */
export function useProfile() {
  const user = useUser();
  const progress = useProgressState();
  const chapters = useChapters();
  const achievements = useAchievements();
  const team = useTeam();
  const queries = [user, progress, chapters, achievements, team] as const;

  const view =
    user.data !== undefined &&
    progress.data !== undefined &&
    chapters.data !== undefined &&
    achievements.data !== undefined &&
    team.data !== undefined
      ? buildProfileView({
          user: user.data,
          progress: progress.data,
          chapters: chapters.data,
          achievements: achievements.data,
          team: team.data,
          totalDays: CHALLENGE.totalDays,
        })
      : null;

  return {
    view,
    error: queries.find((query) => query.isError)?.error ?? null,
    retry: () => {
      for (const query of queries) if (query.isError) void query.refetch();
    },
  };
}
