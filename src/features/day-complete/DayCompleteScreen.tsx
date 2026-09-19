import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, LoadingState, Screen } from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';
import { claimDayCelebration } from '@/features/progress/use-cases';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { rememberDayCelebrated, wasDayCelebrated } from '@/features/quests/celebrations';
import { CelebrationOverlay } from '@/features/today/components/CelebrationOverlay';
import { logger } from '@/lib/logger';
import type { DayCompletion } from '@/schemas';
import { durations, spacing } from '@/theme';
import { clamp, formatNumber } from '@/utils/number';

import { DayHero } from './components/DayHero';
import { DayJourney } from './components/DayJourney';
import { DayStats } from './components/DayStats';
import { Reveal } from './components/Reveal';
import { useDaySequence } from './hooks/use-day-sequence';
import { useDaySummary } from './queries';
import type { DaySummary } from './use-cases';

/** Keeps a double tap on "Finish Day" from landing on "Back to Home". */
const CTA_DELAY_MS = { celebrate: 900, quiet: 350 };
/** Taps this early are the tail of the tap that opened the screen, not a skip. */
const SKIP_AFTER_MS = 600;

/**
 * The end of a day: what it earned, the streak it made and where the journey
 * stands. The first visit celebrates (once, ever); reopening shows the same
 * summary quietly.
 */
export function DayCompleteScreen() {
  const params = useLocalSearchParams<{ day: string }>();
  const day = Number(params.day);
  const valid = Number.isInteger(day) && day >= 1 && day <= CHALLENGE.totalDays;
  return valid ? <DayComplete day={day} /> : <DayNotFinished day={null} />;
}

function DayComplete({ day }: { day: number }) {
  const query = useDaySummary(day);
  // Decided once, from fresh data: a refetch after the claim must not change it.
  const [celebrate, setCelebrate] = useState<boolean | null>(null);
  const fresh = query.data !== undefined && !query.isFetching;
  if (fresh && celebrate === null) {
    const record = query.data.record;
    setCelebrate(record !== null && record.celebratedAt === null && !wasDayCelebrated(record));
  }

  if (query.isError) {
    return (
      <Screen fullScreenModal edges={['top', 'bottom']} background="warm">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  if (!query.data || celebrate === null) {
    return (
      <Screen fullScreenModal edges={['top', 'bottom']} background="warm">
        <LoadingState />
      </Screen>
    );
  }
  if (!query.data.record) return <DayNotFinished day={day} />;
  return <DaySummaryView summary={query.data} record={query.data.record} celebrate={celebrate} />;
}

/**
 * "Back to Home": closes the summary and whatever it was opened over (the last
 * quest's result), straight back to the journey. Android's back button does the same.
 */
function useLeave() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = () => {
    invalidateProgress(queryClient);
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  const onBack = useEffectEvent(() => {
    leave();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, []);

  return leave;
}

function DaySummaryView({
  summary,
  record,
  celebrate,
}: {
  summary: DaySummary;
  record: DayCompletion;
  celebrate: boolean;
}) {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const leave = useLeave();
  const { width } = useWindowDimensions();
  const sequence = useDaySequence(
    celebrate,
    `Day ${summary.day} complete. ${record.questCount} of ${record.questCount} quests, ` +
      `${formatNumber(record.xpEarned)} XP today, ${record.streakAfter} day streak.`,
  );
  const [ctaReady, setCtaReady] = useState(false);
  const [openedAt] = useState(Date.now);

  // The celebration is claimed at once — in memory for this session, and in
  // storage so a relaunch (or a second tap) can never play it again.
  const claim = useEffectEvent(() => {
    rememberDayCelebrated(record);
    claimDayCelebration(repositories, record.day)
      .then(() => invalidateProgress(queryClient))
      .catch((error: unknown) => logger.warn('could not save the day celebration', error));
  });
  useEffect(() => {
    if (celebrate) claim();
  }, [celebrate]);

  useEffect(() => {
    const timer = setTimeout(
      () => setCtaReady(true),
      celebrate ? CTA_DELAY_MS.celebrate : CTA_DELAY_MS.quiet,
    );
    return () => clearTimeout(timer);
  }, [celebrate]);

  const skip = () => {
    if (Date.now() - openedAt >= SKIP_AFTER_MS) sequence.skip();
  };

  const confetti = sequence.animated && sequence.reached('confetti');

  return (
    <Screen
      fullScreenModal
      edges={['top', 'bottom']}
      background="warm"
      overlay={
        <CelebrationOverlay
          playKey={confetti ? summary.day : null}
          sparkles={false}
          peakOpacity={0.6}
        />
      }
      testID="day-complete-screen">
      <Pressable style={styles.fill} onPress={skip} disabled={!sequence.running} accessible={false}>
        <QuestStage
          centered
          footer={
            ctaReady ? (
              <Animated.View entering={FadeIn.duration(durations.normal)}>
                <Button label="Back to Home" onPress={leave} fullWidth testID="day-complete-home" />
              </Animated.View>
            ) : (
              <View style={styles.ctaSpace} />
            )
          }>
          <DayHero
            width={clamp(Math.round(width * 0.78), 240, 340)}
            animated={sequence.animated}
            sparkle={confetti}
          />

          <Reveal shown={sequence.reached('title')} style={styles.titles}>
            <AppText variant="overline" color="brand" align="center">
              {`Day ${summary.day} complete`}
            </AppText>
            <AppText variant="display" align="center" accessibilityRole="header">
              Great work.
            </AppText>
            <AppText variant="bodyLarge" color="secondary" align="center">
              {record.isPerfect
                ? 'A perfect day: every answer right.'
                : 'Every quest done. The fire is lit.'}
            </AppText>
          </Reveal>

          <Reveal shown={sequence.reached('stats')}>
            <DayStats record={record} sequence={sequence} />
          </Reveal>

          <Reveal shown={sequence.reached('stats')}>
            <DayJourney summary={summary} sequence={sequence} summitWidth={52} />
          </Reveal>
        </QuestStage>
      </Pressable>
    </Screen>
  );
}

/** Reached without a finished day (an old link, a reset): nothing to celebrate. */
function DayNotFinished({ day }: { day: number | null }) {
  const leave = useLeave();
  return (
    <Screen fullScreenModal edges={['top', 'bottom']} background="warm">
      <QuestStage centered footer={<Button label="Back to Home" onPress={leave} fullWidth />}>
        <View style={styles.titles}>
          <AppText variant="title2" align="center" accessibilityRole="header">
            {day === null ? 'This day does not exist' : `Day ${day} is not finished yet`}
          </AppText>
          <AppText variant="body" color="secondary" align="center">
            Finish every quest of the day to reach camp.
          </AppText>
        </View>
      </QuestStage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  titles: { gap: spacing[2] },
  ctaSpace: { height: 56 },
});
