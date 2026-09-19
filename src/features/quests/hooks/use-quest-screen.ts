import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { invalidateProgress } from '@/features/progress/queries';

import { useQuestRun } from '../queries';
import type { RunMode } from './use-quest-flow';

export type QuestScreenMode = RunMode | 'completed';

/**
 * What every quest screen starts with: fresh run data, whether this is a new
 * run or a finished quest, and a way back to the journey.
 */
export function useQuestScreen(questId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuestRun(questId);
  // Decided once, from fresh data: later refetches must not swap the screen.
  const [mode, setMode] = useState<QuestScreenMode | null>(null);
  const ready = query.data !== undefined && !query.isFetching;
  if (ready && mode === null) setMode(query.data.completion ? 'completed' : 'play');

  const close = () => {
    invalidateProgress(queryClient);
    router.back();
  };

  return { query, mode, setMode, close };
}
