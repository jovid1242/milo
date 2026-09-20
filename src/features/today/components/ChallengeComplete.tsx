import { Image } from 'expo-image';
import { useIsFocused, useRouter } from 'expo-router';
import { Flag, Trophy, UserRound } from 'lucide-react-native';
import { useEffect, useEffectEvent } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, Divider, Screen, StatsRow } from '@/components/ui';
import { chapters, journey as journeyArt } from '@/constants/assets';
import { LinkRow } from '@/features/profile/components/LinkRow';
import { colors, durations, radius, spacing } from '@/theme';
import { formatNumber } from '@/utils/number';

import type { TodayJourney } from '../logic/today-journey';

/** The unseen victory is offered once per app session, never in a loop. */
let victoryOffered = false;

/**
 * Home after the summit. There is no Day 91 — no quests, no "0 of 4" — just
 * the journey finished: the summit, the days, and where to look back from.
 */
export function ChallengeComplete({ journey }: { journey: TodayJourney }) {
  const router = useRouter();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const completion = journey.challengeCompletion;
  const allDays = journey.completedDays === journey.totalDays;

  // If the app stopped before the victory could play, it plays now — once.
  // Seen already (celebrated), reopening the app just shows this page.
  const offerVictory = useEffectEvent(() => {
    if (victoryOffered || !completion || completion.celebratedAt !== null) return;
    victoryOffered = true;
    router.push('/summit');
  });
  useEffect(() => {
    if (focused) offerVictory();
  }, [focused]);

  const artWidth = width - spacing[5] * 2;
  return (
    <Screen scroll background="warm" testID="challenge-complete">
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(durations.slow)} style={styles.art}>
          <Image
            source={chapters.summit.source}
            contentFit="cover"
            accessibilityLabel="Milo on the summit with his flag"
            style={{ width: artWidth, height: Math.round((artWidth * 2) / 3) }}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(durations.normal).delay(120)}
          style={styles.titles}>
          <AppText variant="overline" color="reward" align="center">
            {`${journey.totalDays} Day Journey Complete`}
          </AppText>
          <AppText variant="title1" align="center" accessibilityRole="header">
            You reached the summit.
          </AppText>
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(durations.normal).delay(240)}
          style={styles.counter}
          accessible
          accessibilityLabel={`${journey.completedDays} of ${journey.totalDays} days`}>
          <AssetImage asset={journeyArt.flagComplete} width={36} />
          <AppText variant="displayLarge">
            {`${journey.completedDays} / ${journey.totalDays}`}
          </AppText>
          <AppText variant="label" color="secondary">
            {allDays ? 'days' : 'days walked'}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(durations.normal).delay(320)}>
          <StatsRow
            stats={[
              { label: 'day streak', value: String(journey.streak) },
              { label: 'total XP', value: formatNumber(journey.totalXp) },
            ]}
          />
        </Animated.View>

        <Button
          label="View Journey"
          icon={Flag}
          onPress={() => router.navigate('/journey')}
          fullWidth
          testID="complete-view-journey"
        />

        <View style={styles.links}>
          <LinkRow
            icon={Trophy}
            label="Achievements"
            hint="Every badge from the climb"
            onPress={() => router.push('/achievements')}
          />
          <Divider />
          <LinkRow
            icon={UserRound}
            label="Profile"
            hint="Your 90 days in numbers"
            onPress={() => router.navigate('/profile')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[8] },
  art: {
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface.warm,
  },
  titles: { gap: spacing[2] },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  links: { gap: spacing[1] },
});
