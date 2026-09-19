import { useState } from 'react';

import type { Journey } from '@/schemas';

export type Reveal = { days: number[]; key: number };

/**
 * Days completed since the map was last on screen — their nodes pop once when
 * the user comes back. Compared only while focused, so a day finished on Home
 * is revealed here, and a relaunch (or a big dev jump) replays nothing.
 */
export function useRevealCompleted(journey: Journey, focused: boolean): Reveal {
  const [seen, setSeen] = useState<ReadonlySet<number> | null>(null);
  const [reveal, setReveal] = useState<Reveal>({ days: [], key: 0 });

  if (focused) {
    const done = journey.days.filter((day) => day.state === 'completed').map((day) => day.day);
    const changed =
      seen === null || done.length !== seen.size || done.some((day) => !seen.has(day));
    if (changed) {
      setSeen(new Set(done));
      const newly = seen === null ? [] : done.filter((day) => !seen.has(day));
      if (newly.length > 0 && newly.length <= 3) setReveal({ days: newly, key: reveal.key + 1 });
    }
  }
  return reveal;
}
