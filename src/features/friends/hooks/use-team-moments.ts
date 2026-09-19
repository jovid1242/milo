import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import { playFeedback } from '@/services/feedback';

import type { TeamView } from '../logic/team';

type Snapshot = { memberIds: readonly string[]; complete: boolean; day: number };

export type TeamMoments = {
  /** Increments per moment. */
  id: number;
  /** Members who joined since the screen last looked (their cards fade in). */
  joinedIds: readonly string[];
  /** Set when the team day completed while away: the summary sparkles once. */
  completeKey: number | null;
};

/**
 * Team changes worth a moment, taken only while Friends is on screen (like
 * Home): a friend joined — the one sound here — or the team finished the day.
 * Opening the tab, or relaunching, replays nothing.
 */
export function useTeamMoments(view: TeamView | null): TeamMoments {
  const focused = useIsFocused();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [moments, setMoments] = useState<TeamMoments>({ id: 0, joinedIds: [], completeKey: null });

  // Compared while rendering, so new cards never flash in before their entrance.
  if (focused && view) {
    const next: Snapshot = {
      memberIds: view.members.map((member) => member.id),
      complete: view.isTeamDayComplete,
      day: view.currentDay,
    };
    const changed =
      snapshot === null ||
      snapshot.complete !== next.complete ||
      snapshot.day !== next.day ||
      snapshot.memberIds.join() !== next.memberIds.join();
    if (changed) {
      setSnapshot(next);
      if (snapshot !== null && snapshot.day === next.day) {
        const completed = !snapshot.complete && next.complete;
        setMoments({
          id: moments.id + 1,
          joinedIds: next.memberIds.filter((id) => !snapshot.memberIds.includes(id)),
          completeKey: completed ? moments.id + 1 : moments.completeKey,
        });
      }
    }
  }

  const joined = moments.joinedIds.length > 0;
  useEffect(() => {
    if (joined) playFeedback('friendJoined');
  }, [moments.id, joined]);

  return moments;
}
