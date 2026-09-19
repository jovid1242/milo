import { useRouter, useSegments } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';

import type { Achievement, AchievementId } from '@/schemas';

import { planCelebration } from '../logic/evaluate-achievements';
import { useMarkCelebrated, usePendingCelebrations } from '../queries';
import { AchievementCelebration } from './AchievementCelebration';

/** Home's own reward moment lands first; then the badge. */
const SETTLE_MS = 900;

type Shown = { lead: Achievement; others: Achievement[] };

/**
 * The one place achievement celebrations are presented. New unlocks are
 * persisted with no `celebratedAt`; this host shows them only on a calm screen
 * (the tabs — never over a quest, its result or Day Complete), one card for
 * everything unlocked together, and claims them the moment they are shown: a
 * reload never replays a celebration.
 */
export function AchievementCelebrationHost() {
  const router = useRouter();
  const segments = useSegments();
  const pending = usePendingCelebrations();
  const markCelebrated = useMarkCelebrated();
  const calm = segments[0] === '(tabs)';
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  // Claimed this session: the pending list may refetch a beat after the claim lands.
  const [claimed, setClaimed] = useState<ReadonlySet<AchievementId>>(() => new Set());

  // Leaving the calm screens cancels readiness; arriving starts the short wait.
  if (!calm && ready) setReady(false);
  useEffect(() => {
    if (!calm) return;
    const timer = setTimeout(() => setReady(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [calm]);

  // Chosen while rendering: one card for everything waiting right now.
  const waiting = (pending.data ?? []).filter((achievement) => !claimed.has(achievement.id));
  if (ready && !shown && waiting.length > 0) {
    const plan = planCelebration(waiting);
    if (plan) {
      setShown(plan);
      setClaimed(new Set([...claimed, plan.lead.id, ...plan.others.map((item) => item.id)]));
    }
  }

  // Stored as celebrated as soon as it is on screen.
  const claim = useEffectEvent((ids: AchievementId[]) => markCelebrated.mutate(ids));
  useEffect(() => {
    if (shown) claim([shown.lead.id, ...shown.others.map((item) => item.id)]);
  }, [shown]);

  if (!shown) return null;
  return (
    <AchievementCelebration
      lead={shown.lead}
      others={shown.others}
      onDone={() => setShown(null)}
      onSeeAll={() => {
        setShown(null);
        router.push('/achievements');
      }}
    />
  );
}
