import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button, StatsRow } from '@/components/ui';
import { badges, chapters, effects, journey, mascots } from '@/constants/assets';
import { useCountUp } from '@/hooks/use-count-up';
import { playFeedback } from '@/services/feedback';
import { colors, durations, layout, radius, spacing } from '@/theme';
import { clamp, formatNumber } from '@/utils/number';

import type { SummitView } from '../use-cases';

/** Milo's last steps, then the arrival. */
const CLIMB_MS = 1900;
const CROSSFADE_MS = 700;
const CONFETTI_MS = 3200;

export type SummitVictoryProps = {
  view: SummitView;
  /** The first time ever: the climb, the music, the confetti. Otherwise the view rests. */
  celebrate: boolean;
  onSeeJourney: () => void;
};

/**
 * The finale. Milo climbs the last steps of the peak; at the top the scene
 * opens onto the summit — flag planted — with the one sound of the moment;
 * then what the 90 days made: the days, the streak, the XP, the words, the
 * badge. Everything that happened at once (the Final Battle, Day 90, the
 * challenge, a perfect score, the 90-day badge) is told here, together.
 */
export function SummitVictory({ view, celebrate, onSeeJourney }: SummitVictoryProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const animate = celebrate && !reduceMotion;
  const sceneHeight = Math.min(Math.round(width * 0.78), Math.round(height * 0.36));
  const [arrived, setArrived] = useState(!animate);
  const [peakShown, setPeakShown] = useState(animate);
  // Without motion the victory lands at once; the confetti still falls, briefly.
  const [confetti, setConfetti] = useState(celebrate && !animate);

  const climb = useSharedValue(animate ? 0 : 1);
  const summit = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!celebrate) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const land = () => {
      // The one sound of the finale — and its strong, short haptic.
      playFeedback('summitVictory');
      timers.push(setTimeout(() => setConfetti(false), CONFETTI_MS));
    };
    if (animate) {
      climb.set(withTiming(1, { duration: CLIMB_MS, easing: Easing.inOut(Easing.quad) }));
      summit.set(withDelay(CLIMB_MS, withTiming(1, { duration: CROSSFADE_MS })));
      timers.push(
        setTimeout(() => {
          setArrived(true);
          setConfetti(true);
          land();
          // The climb's scene is gone once the summit covers it: its image is freed.
          timers.push(setTimeout(() => setPeakShown(false), CROSSFADE_MS + 100));
        }, CLIMB_MS),
      );
    } else {
      land();
    }
    return () => timers.forEach(clearTimeout);
  }, [celebrate, animate, climb, summit]);

  const climberWidth = clamp(Math.round(width * 0.24), 84, 120);
  const climberStyle = useAnimatedStyle(() => {
    const t = climb.get();
    return {
      opacity: 1 - summit.get(),
      transform: [
        { translateX: t * width * 0.28 },
        { translateY: -t * sceneHeight * 0.46 },
        { scale: 1 - t * 0.42 },
      ],
    };
  });
  const peakStyle = useAnimatedStyle(() => ({
    opacity: 1 - summit.get(),
    transform: [{ scale: 1.06 - climb.get() * 0.06 }],
  }));
  const summitStyle = useAnimatedStyle(() => ({
    opacity: summit.get(),
    transform: [{ scale: 1.05 - summit.get() * 0.05 }],
  }));

  return (
    // Full-bleed like the intro: the scene spans the screen, the words keep their margins.
    <View style={[styles.fill, styles.bleed]} testID="summit-victory">
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View
          style={[styles.scene, { height: sceneHeight }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Milo on the summit, planting the flag.">
          {peakShown ? (
            <Animated.View style={[StyleSheet.absoluteFill, peakStyle]}>
              <Image
                source={journey.summitPeak.source}
                contentFit="cover"
                contentPosition="top"
                accessible={false}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                style={[styles.climber, { left: Math.round(width * 0.06) }, climberStyle]}>
                <AssetImage asset={mascots.walking} width={climberWidth} />
              </Animated.View>
            </Animated.View>
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, summitStyle]}>
            <Image
              source={chapters.summit.source}
              contentFit="cover"
              accessible={false}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {confetti ? (
            <Confetti width={width} height={sceneHeight} reduceMotion={reduceMotion} />
          ) : null}
        </View>

        {arrived ? (
          <Numbers view={view} celebrate={celebrate} />
        ) : (
          // The last steps: the result that led here, still in view.
          <Animated.View entering={FadeIn.duration(durations.normal)} style={styles.climbing}>
            <AppText variant="overline" color="reward" align="center">
              Final Battle passed
            </AppText>
            <AppText variant="bodyLarge" color="secondary" align="center">
              The last steps…
            </AppText>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {arrived ? (
          <Animated.View entering={FadeIn.duration(durations.normal).delay(celebrate ? 900 : 0)}>
            <Button
              label="See my journey"
              onPress={onSeeJourney}
              fullWidth
              testID="summit-see-journey"
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/** One burst over the summit: falls a little, fades, and is gone. */
function Confetti({
  width,
  height,
  reduceMotion,
}: {
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.set(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(2, { duration: CONFETTI_MS - 900, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [fall]);
  const style = useAnimatedStyle(() => {
    const t = fall.get();
    return {
      opacity: t <= 1 ? t : Math.max(0, 2 - t),
      transform: reduceMotion ? [] : [{ translateY: -height * 0.12 + t * height * 0.1 }],
    };
  });
  return (
    <Animated.View style={[styles.overlay, style]} pointerEvents="none">
      <AssetImage asset={effects.confetti} width={Math.round(width * 1.1)} />
    </Animated.View>
  );
}

/** What the 90 days made — four numbers, a badge, one line. */
function Numbers({ view, celebrate }: { view: SummitView; celebrate: boolean }) {
  const { completion, completedDays, totalDays, streak, totalXp, wordsLearned } = view;
  const allDays = completedDays === totalDays;
  const gained = completion.xpEarned + view.badges.reduce((sum, badge) => sum + badge.xpReward, 0);
  const shownDays = useCountUp(
    completedDays,
    celebrate && completedDays > 0
      ? { key: 'summit-days', from: completedDays - 1, to: completedDays }
      : null,
    { delayMs: 700, durationMs: 500 },
  );
  const shownXp = useCountUp(
    totalXp,
    celebrate && gained > 0
      ? { key: 'summit-xp', from: Math.max(0, totalXp - gained), to: totalXp }
      : null,
    { delayMs: 1300, durationMs: 1100 },
  );
  const at = (ms: number) => (celebrate ? ms : 0);
  const percent = Math.round(completion.score * 100);
  // A perfect Final Battle: one spark behind the days, then only the glow stays.
  const [spark, setSpark] = useState(celebrate && completion.isPerfect);
  useEffect(() => {
    if (!spark) return;
    const timer = setTimeout(() => setSpark(false), 2200);
    return () => clearTimeout(timer);
  }, [spark]);

  return (
    <View style={styles.numbers}>
      <Animated.View
        entering={FadeInUp.duration(durations.slow).delay(at(200))}
        style={styles.titles}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${allDays ? `${totalDays} days complete` : 'Summit reached'}. You reached the summit.`}>
        <AppText variant="overline" color="reward" align="center">
          {allDays ? `${totalDays} days complete` : 'Summit reached'}
        </AppText>
        <AppText variant="title1" align="center">
          You reached the summit.
        </AppText>
      </Animated.View>

      <Animated.View
        entering={FadeIn.duration(durations.slow).delay(at(500))}
        style={styles.counter}
        accessible
        accessibilityLabel={`${completedDays} of ${totalDays} days`}>
        {completion.isPerfect ? (
          <View style={styles.rays} pointerEvents="none">
            <AssetImage asset={effects.perfectRays} width={260} />
          </View>
        ) : null}
        {spark ? (
          <Animated.View
            entering={FadeIn.duration(400).delay(600)}
            exiting={FadeOut.duration(800)}
            style={styles.rays}
            pointerEvents="none">
            <AssetImage asset={effects.sparkles} width={200} />
          </Animated.View>
        ) : null}
        <AssetImage asset={journey.flagComplete} width={44} />
        <AppText variant="displayLarge" testID="summit-days">
          {`${shownDays} / ${totalDays}`}
        </AppText>
        <AppText variant="label" color="secondary">
          days
        </AppText>
      </Animated.View>

      <Animated.View
        entering={FadeIn.duration(durations.normal).delay(at(900))}
        style={styles.final}>
        {completion.isPerfect ? <Badge label="Perfect" tone="reward" /> : null}
        <AppText variant="bodyMedium" color="secondary">
          {`Final Battle · ${completion.correctCount} / ${completion.totalCount} · ${percent}%`}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(at(1200))}>
        <StatsRow
          stats={[
            { label: 'day streak', value: String(streak) },
            { label: 'total XP', value: formatNumber(shownXp) },
            { label: 'words learned', value: String(wordsLearned) },
          ]}
        />
      </Animated.View>

      {view.badges.length > 0 ? (
        <Animated.View
          entering={FadeInUp.duration(durations.normal).delay(at(1700))}
          style={styles.badges}>
          {view.badges.slice(0, 3).map((badge) => (
            <View
              key={badge.id}
              style={styles.badge}
              accessible
              accessibilityLabel={`Badge unlocked: ${badge.title}`}>
              <AssetImage asset={badges[badge.badge]} width={40} />
              <AppText variant="bodyStrong" style={styles.badgeText}>
                {badge.title}
              </AppText>
              <AppText variant="overline" color="reward">
                Badge unlocked
              </AppText>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeIn.duration(durations.slow).delay(at(2100))}>
        <AppText variant="bodyLarge" color="secondary" align="center">
          {`${totalDays} days. One step at a time.\nLook how far you’ve come.`}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bleed: { marginHorizontal: -layout.screenPaddingX },
  content: { flexGrow: 1, paddingBottom: spacing[6], gap: spacing[5] },
  scene: { overflow: 'hidden', backgroundColor: colors.surface.warm },
  climber: { position: 'absolute', bottom: 0 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numbers: { gap: spacing[4], paddingHorizontal: layout.screenPaddingX },
  climbing: { gap: spacing[2], paddingHorizontal: layout.screenPaddingX },
  titles: { gap: spacing[2] },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  rays: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  final: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  badges: { gap: spacing[3] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  badgeText: { flex: 1 },
  footer: {
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    paddingHorizontal: layout.screenPaddingX,
    minHeight: 72,
  },
});
