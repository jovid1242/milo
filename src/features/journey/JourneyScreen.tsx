import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState, Screen } from '@/components/ui';
import { triggerHaptic } from '@/services/haptics/haptics';

import { DayDetailsSheet } from './components/DayDetailsSheet';
import { JourneyHeader } from './components/JourneyHeader';
import { JourneyMap } from './components/JourneyMap';
import { useJourney } from './queries';

/** The 90-day map: the whole challenge as one adventure, from base camp to the summit. */
export function JourneyScreen() {
  const router = useRouter();
  const query = useJourney();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (query.isPending) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading the journey" />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen background="warm">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const journey = query.data;
  const today = journey.days[journey.currentDay - 1];
  const selected = selectedDay === null ? null : (journey.days[selectedDay - 1] ?? null);
  if (!today) return null;

  return (
    <Screen padded={false} background="warm" testID="journey-screen">
      <JourneyHeader journey={journey} />
      <JourneyMap
        journey={journey}
        onSelectDay={(day) => {
          // A calm map: a light tap feel, no sound.
          triggerHaptic('selection');
          setSelectedDay(day.day);
        }}
      />
      <DayDetailsSheet
        day={selected}
        today={today}
        chapters={journey.chapters.map((entry) => entry.chapter)}
        onClose={() => setSelectedDay(null)}
        onContinueToday={() => {
          setSelectedDay(null);
          router.navigate('/');
        }}
        onOpenTodaySummary={() => {
          setSelectedDay(null);
          router.push({ pathname: '/day-complete/[day]', params: { day: String(today.day) } });
        }}
      />
    </Screen>
  );
}
