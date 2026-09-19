import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, LoadingState, Screen } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { rememberDayCelebrated } from '@/features/quests/celebrations';
import { spacing } from '@/theme';

import { SummitVictory } from './components/SummitVictory';
import { useClaimSummit, useSummit } from './queries';
import type { SummitView } from './use-cases';

type Mode = 'deciding' | 'celebrate' | 'replay';

/**
 * The Summit Victory — the finale of the whole challenge. It plays once,
 * ever: the first visit claims the moment (and with it Day 90's summary and
 * the badges it shows); every later visit — `?replay=1` from the map, or a
 * reopened app — shows the summit at rest. Nothing here pays anything: the
 * Final Battle's submission already settled every reward.
 */
export function SummitScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const summit = useSummit();
  const claim = useClaimSummit();
  // Decided once, from fresh data: the claim below refreshes progress, and the
  // sequence must keep the badges it started with.
  const [view, setView] = useState<SummitView | null | undefined>(undefined);
  if (summit.data !== undefined && !summit.isFetching && view === undefined) setView(summit.data);
  const [mode, setMode] = useState<Mode>(replay ? 'replay' : 'deciding');
  const claimed = useRef(false);

  const decide = useEffectEvent(() => {
    if (claimed.current) return;
    claimed.current = true;
    claim.mutate(undefined, {
      onSuccess: (first) => {
        if (view) rememberDayCelebrated({ day: 90, completedAt: view.completion.completedAt });
        setMode(first ? 'celebrate' : 'replay');
      },
      onError: () => setMode('replay'),
    });
  });
  useEffect(() => {
    if (view && mode === 'deciding') decide();
  }, [view, mode]);

  const seeJourney = () => router.dismissTo('/journey');
  const onBack = useEffectEvent(() => seeJourney());
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (summit.isError) {
    return (
      <Screen fullScreenModal background="warm">
        <ErrorState error={summit.error} onRetry={() => void summit.refetch()} />
      </Screen>
    );
  }
  if (view === null) {
    // The summit is not reached yet (e.g. an old link): nothing to show but the way back.
    return (
      <Screen fullScreenModal edges={['top', 'bottom']} background="warm">
        <View style={styles.ahead}>
          <AssetImage asset={mascots.walking} width={160} />
          <AppText variant="title2" align="center" accessibilityRole="header">
            The summit is still ahead
          </AppText>
          <Button label="Back to journey" onPress={seeJourney} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen fullScreenModal edges={['top', 'bottom']} background="warm" testID="summit-screen">
      {view && mode !== 'deciding' ? (
        <SummitVictory view={view} celebrate={mode === 'celebrate'} onSeeJourney={seeJourney} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ahead: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
});
