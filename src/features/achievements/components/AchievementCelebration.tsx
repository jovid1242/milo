import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button } from '@/components/ui';
import { badges, effects } from '@/constants/assets';
import type { Achievement } from '@/schemas';
import { playFeedback } from '@/services/feedback';
import { colors, durations, radius, spacing, springs } from '@/theme';
import { clamp } from '@/utils/number';

export type AchievementCelebrationProps = {
  lead: Achievement;
  /** Unlocked at the same time: summed up, never a popup each. */
  others: readonly Achievement[];
  onDone: () => void;
  onSeeAll: () => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * A short unlock moment: the badge (Milo is part of its art) pops in over a
 * burst of sparkles, with the achievement sound and a success haptic — once.
 */
export function AchievementCelebration({
  lead,
  others,
  onDone,
  onSeeAll,
}: AchievementCelebrationProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const badge = useSharedValue(reduceMotion ? 1 : 0.55);
  const glow = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    playFeedback('achievementUnlock');
    AccessibilityInfo.announceForAccessibility(
      `Achievement unlocked: ${lead.title}.${others.length ? ` And ${plural(others.length, 'more achievement')}.` : ''}`,
    );
    if (reduceMotion) return;
    badge.set(withDelay(80, withSpring(1, springs.bouncy)));
    glow.set(
      withSequence(
        withDelay(120, withTiming(1, { duration: 380 })),
        withDelay(700, withTiming(0.35, { duration: 900 })),
      ),
    );
  }, [lead.title, others.length, reduceMotion, badge, glow]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ scale: 0.85 + glow.get() * 0.2 }],
  }));

  const cardWidth = Math.min(width - spacing[5] * 2, 380);
  const badgeSize = clamp(Math.round(cardWidth * 0.5), 150, 190);

  return (
    <Modal transparent visible statusBarTranslucent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { width: cardWidth }]}
          accessibilityViewIsModal
          testID="achievement-celebration">
          <View style={[styles.stage, { height: badgeSize }]}>
            {reduceMotion ? null : (
              <Animated.View pointerEvents="none" style={[styles.sparkles, glowStyle]}>
                <AssetImage asset={effects.sparkles} width={cardWidth} />
              </Animated.View>
            )}
            <Animated.View style={badgeStyle}>
              <AssetImage asset={badges[lead.badge]} width={badgeSize} />
            </Animated.View>
          </View>

          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(durations.normal).delay(220)}
            style={styles.text}>
            <AppText variant="overline" color="reward" align="center">
              Achievement unlocked
            </AppText>
            <AppText variant="title1" align="center" accessibilityRole="header">
              {lead.title}
            </AppText>
            <AppText variant="bodyLarge" color="secondary" align="center">
              {lead.tagline}
            </AppText>
            {lead.xpReward > 0 ? (
              <Badge label={`+${lead.xpReward} XP`} tone="reward" style={styles.xp} />
            ) : null}
          </Animated.View>

          <View style={styles.actions}>
            {others.length > 0 ? (
              <AppText variant="label" color="secondary" align="center">
                {`+${plural(others.length, 'more achievement')} unlocked`}
              </AppText>
            ) : null}
            <Button label="Awesome" onPress={onDone} fullWidth testID="achievement-awesome" />
            {others.length > 0 ? (
              <Button label="See all achievements" variant="ghost" onPress={onSeeAll} fullWidth />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.scrim,
  },
  card: {
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
    borderRadius: radius.xxl,
    backgroundColor: colors.background.warm,
  },
  stage: { alignItems: 'center', justifyContent: 'center' },
  sparkles: { position: 'absolute', alignItems: 'center' },
  text: { alignItems: 'center', gap: spacing[1] },
  xp: { alignSelf: 'center', marginTop: spacing[2] },
  actions: { alignSelf: 'stretch', gap: spacing[2] },
});
