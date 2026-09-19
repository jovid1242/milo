import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button, IconButton } from '@/components/ui';
import { journey, mascots } from '@/constants/assets';
import { durations, layout, spacing } from '@/theme';
import { clamp } from '@/utils/number';

export type SummitIntroProps = {
  day: number;
  questions: number;
  minutes: number;
  xpReward: number;
  onClimb: () => void;
  onClose: () => void;
};

/**
 * Day 90 opens like no other day: the summit ahead, Milo at the foot of the
 * last steps, three short lines and one way up. The scene settles in slowly —
 * a camera tilting to the top — and then rests.
 */
export function SummitIntro({
  day,
  questions,
  minutes,
  xpReward,
  onClimb,
  onClose,
}: SummitIntroProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const sceneWidth = width;
  const sceneHeight = Math.min(Math.round(width * 0.98), Math.round(height * 0.5));
  const miloWidth = clamp(Math.round(width * 0.3), 104, 150);

  const settle = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    settle.set(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, settle]);
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, settle.get() * 2),
    transform: [{ scale: 1.08 - settle.get() * 0.08 }, { translateY: (1 - settle.get()) * 18 }],
  }));

  return (
    // Full-bleed: the whole intro runs under the screen's side padding (a
    // ScrollView clips negative margins); the text keeps its own.
    <View style={[styles.fill, styles.bleed]} testID="summit-intro">
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.scene, { width: sceneWidth, height: sceneHeight }]}>
          <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
            <Image
              source={journey.summitPeak.source}
              contentFit="cover"
              contentPosition="top"
              accessible={false}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            entering={
              reduceMotion ? undefined : FadeInLeft.duration(durations.slow + 300).delay(500)
            }
            style={[styles.milo, { left: Math.round(sceneWidth * 0.04) }]}>
            <AssetImage asset={mascots.walking} width={miloWidth} />
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInUp.duration(durations.slow).delay(reduceMotion ? 0 : 700)}
          style={styles.text}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Chapter 5, Summit. Day ${day}. You've made it this far. One final challenge remains.`}>
          <AppText variant="overline" color="wood" align="center">
            Chapter 05 · Summit
          </AppText>
          <AppText variant="displayLarge" align="center">
            {`Day ${day}`}
          </AppText>
          <AppText variant="bodyLarge" color="secondary" align="center">
            {'You’ve made it this far.\nOne final challenge remains.'}
          </AppText>
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(durations.normal).delay(reduceMotion ? 0 : 1100)}
          style={styles.meta}>
          <Badge label={`${questions} questions`} tone="wood" />
          <AppText variant="label" color="secondary">
            {`~${minutes} min`}
          </AppText>
          {xpReward > 0 ? <Badge label={`+${xpReward} XP`} tone="reward" /> : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Climb to the summit"
          onPress={onClimb}
          fullWidth
          accessibilityHint="Opens the Final Battle"
          testID="summit-climb"
        />
      </View>

      <IconButton
        icon={X}
        variant="soft"
        accessibilityLabel="Leave"
        onPress={onClose}
        style={styles.close}
        testID="summit-close"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bleed: { marginHorizontal: -layout.screenPaddingX },
  content: { flexGrow: 1, paddingBottom: spacing[6], gap: spacing[5] },
  scene: { overflow: 'hidden' },
  milo: { position: 'absolute', bottom: 0 },
  text: { gap: spacing[2], alignItems: 'center', paddingHorizontal: layout.screenPaddingX },
  meta: {
    paddingHorizontal: layout.screenPaddingX,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  footer: {
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    paddingHorizontal: layout.screenPaddingX,
  },
  close: { position: 'absolute', top: spacing[2], left: spacing[3] },
});
