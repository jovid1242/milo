import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, StatsRow } from '@/components/ui';
import { badges, effects, mascots } from '@/constants/assets';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { useCountUp } from '@/hooks/use-count-up';
import { colors, durations, radius, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import type { ResultSummary } from '../hooks/use-vocabulary-flow';
import { WordChips } from './WordChips';

export type VocabularyResultProps = {
  summary: ResultSummary;
  saveFailed: boolean;
  onRetrySave: () => void;
  onContinue: () => void;
};

function subtitleFor(summary: ResultSummary): string {
  if (!summary.firstCompletion) return 'Practice done. The XP was earned the first time.';
  if (summary.isPerfect) return 'Every answer right.';
  return `${summary.wordsLearned.length} new words for the journey.`;
}

/**
 * The reward moment. A perfect run adds slow golden rays and a spark of
 * sparkles behind Milo — once, then everything rests.
 */
export function VocabularyResult({
  summary,
  saveFailed,
  onRetrySave,
  onContinue,
}: VocabularyResultProps) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const heroWidth = clamp(Math.round(width * 0.5), 170, 220);
  const heroHeight = Math.round(heroWidth * 0.95);
  // The glow may reach a little past Milo, but never up into the progress bar.
  const raysWidth = Math.round(heroWidth * 1.4);
  const raysHeight = Math.round(
    (raysWidth * effects.perfectRays.height) / effects.perfectRays.width,
  );
  const raysOverflow = Math.max(0, Math.round((raysHeight - heroHeight) / 2));
  const xp = summary.xpEarned;
  const shownXp = useCountUp(
    xp ?? 0,
    xp !== null && xp > 0 ? { key: 'result', from: 0, to: xp } : null,
    { delayMs: 400 },
  );

  const rays = useSharedValue(0);
  const sparkle = useSharedValue(0);
  useEffect(() => {
    if (!summary.isPerfect) return;
    rays.set(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }));
    sparkle.set(
      withSequence(
        withDelay(250, withTiming(1, { duration: 400 })),
        withDelay(700, withTiming(0, { duration: 700 })),
      ),
    );
  }, [summary.isPerfect, rays, sparkle]);

  const raysStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.85, rays.get() * 3),
    transform: reduceMotion
      ? []
      : [{ rotate: `${rays.get() * 24}deg` }, { scale: 0.8 + rays.get() * 0.2 }],
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.get(),
    transform: reduceMotion ? [] : [{ scale: 0.85 + sparkle.get() * 0.2 }],
  }));

  return (
    <QuestStage
      centered
      footer={
        saveFailed ? (
          <>
            <AppText variant="caption" color="danger" align="center">
              Your result could not be saved yet.
            </AppText>
            <Button label="Try again" onPress={onRetrySave} fullWidth />
          </>
        ) : (
          <Button
            label="Continue journey"
            onPress={onContinue}
            fullWidth
            disabled={xp === null}
            testID="vocabulary-continue-journey"
          />
        )
      }>
      <View
        style={[
          styles.hero,
          { height: heroHeight, marginTop: summary.isPerfect ? raysOverflow : 0 },
        ]}>
        {summary.isPerfect ? (
          <Animated.View style={[styles.layer, raysStyle]}>
            <AssetImage asset={effects.perfectRays} width={raysWidth} />
          </Animated.View>
        ) : null}
        <Animated.View entering={ZoomIn.duration(durations.slow)}>
          <AssetImage asset={mascots.correct} width={heroWidth} />
        </Animated.View>
        {summary.isPerfect ? (
          <Animated.View style={[styles.layer, sparkleStyle]}>
            <AssetImage asset={effects.sparkles} width={Math.round(heroWidth * 1.3)} />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View
        entering={FadeInUp.duration(durations.normal).delay(120)}
        style={styles.titles}>
        <AppText variant="display" align="center" accessibilityRole="header">
          {summary.isPerfect ? 'Perfect run!' : 'Vocabulary complete'}
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          {subtitleFor(summary)}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(240)} style={styles.stats}>
        <StatsRow
          stats={[
            { label: 'correct', value: `${summary.correctCount}/${summary.total}` },
            { label: 'XP', value: xp === null ? '…' : xp === 0 ? '0' : `+${shownXp}` },
            { label: 'words', value: String(summary.wordsLearned.length) },
          ]}
        />
        {summary.perfectBonus > 0 ? (
          <AppText variant="caption" color="reward" align="center">
            {`Includes +${summary.perfectBonus} XP for a perfect run`}
          </AppText>
        ) : null}
      </Animated.View>

      {summary.newAchievements.map((achievement) => (
        <Animated.View
          key={achievement.id}
          entering={FadeInUp.duration(durations.normal).delay(360)}
          style={styles.badge}
          accessible
          accessibilityLabel={`Badge unlocked: ${achievement.title}, ${achievement.xpReward} XP`}>
          <AssetImage asset={badges[achievement.id]} width={44} />
          <View style={styles.badgeText}>
            <AppText variant="bodyStrong">{`${achievement.title} badge`}</AppText>
            <AppText variant="caption" color="reward">
              {`+${achievement.xpReward} XP`}
            </AppText>
          </View>
        </Animated.View>
      ))}

      <Animated.View entering={FadeIn.duration(durations.normal).delay(420)}>
        <WordChips words={summary.wordsLearned} />
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  titles: { gap: spacing[2] },
  stats: { gap: spacing[2] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingLeft: spacing[2],
    paddingRight: spacing[5],
    borderRadius: radius.pill,
    backgroundColor: colors.reward.goldSoft,
  },
  badgeText: { gap: 0 },
});
