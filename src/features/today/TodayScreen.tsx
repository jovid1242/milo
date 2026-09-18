import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState, Screen } from '@/components/ui';
import { useStartQuest } from '@/features/progress/queries';
import { spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { CelebrationOverlay } from './components/CelebrationOverlay';
import { MiloGreeting } from './components/MiloGreeting';
import { TodayHeader } from './components/TodayHeader';
import { TodayJourneySection } from './components/TodayJourneySection';
import { useJourneyMoments } from './hooks/use-journey-moments';
import { getGreeting } from './logic/greeting';
import type { JourneyStep, TodayJourney } from './logic/today-journey';
import { useTodayJourney } from './queries';

/** Home: the daily entry point into the challenge. */
export function TodayScreen() {
  const journey = useTodayJourney();

  if (journey.isPending) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading your day" />
      </Screen>
    );
  }

  if (journey.isError) {
    return (
      <Screen background="warm">
        <ErrorState error={journey.error} onRetry={() => void journey.refetch()} />
      </Screen>
    );
  }

  return <TodayContent journey={journey.data} />;
}

/** Guards against a double tap pushing the quest screen twice. */
const OPEN_COOLDOWN_MS = 800;

function TodayContent({ journey }: { journey: TodayJourney }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const startQuest = useStartQuest();
  const moment = useJourneyMoments(journey);
  const lastOpenedAt = useRef(0);

  const openQuest = (step: JourneyStep) => {
    const now = Date.now();
    if (now - lastOpenedAt.current < OPEN_COOLDOWN_MS) return;
    lastOpenedAt.current = now;
    startQuest.mutate(step.quest.id);
    router.push({ pathname: '/quest/[questId]', params: { questId: step.quest.id } });
  };

  const celebrateKey = moment?.dayCompleted ? moment.id : null;

  return (
    <Screen
      scroll
      background="warm"
      overlay={<CelebrationOverlay playKey={celebrateKey} />}
      testID="today-screen">
      <View style={styles.content}>
        <TodayHeader journey={journey} moment={moment} />
        <MiloGreeting
          greeting={getGreeting(journey)}
          miloWidth={clamp(Math.round(width * 0.25), 88, 116)}
          celebrateKey={celebrateKey}
        />
        <TodayJourneySection
          journey={journey}
          moment={moment}
          campArtWidth={clamp(Math.round(width * 0.34), 116, 150)}
          onOpenQuest={openQuest}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[3], paddingBottom: spacing[6] },
});
