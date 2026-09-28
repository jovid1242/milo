import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { chapters } from '@/constants/assets';
import { colors, durations, layout, radius, spacing } from '@/theme';

/**
 * The last moment before Day 1: Chapter 01 — Milo setting off — and the one
 * thing left to do. The illustration settles in like a chapter opening; with
 * Reduce Motion it is simply there.
 */
export function ReadyStep() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const artWidth = Math.min(width, layout.maxContentWidth) - layout.screenPaddingX * 2;
  // The chapter art is 3:2; on a short screen it gives up height, never the text.
  const artHeight = Math.round(Math.min((artWidth * 2) / 3, height * 0.36));

  const settle = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    settle.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, settle]);
  const artStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, settle.get() * 1.6),
    transform: [{ scale: 1.06 - settle.get() * 0.06 }],
  }));

  return (
    <View style={styles.step} testID="onboarding-ready">
      <View style={[styles.art, { height: artHeight }]}>
        <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
          <Image
            source={chapters.beginning.source}
            contentFit="cover"
            // The chapter's own lettering sits at the top of the illustration.
            contentPosition="top"
            accessibilityLabel="Chapter 01, The Beginning: Milo sets off on the trail, days 1 to 10"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.duration(durations.normal).delay(reduceMotion ? 0 : 350)}
        style={styles.text}>
        <AppText variant="overline" color="wood" align="center">
          Day 1 of 90
        </AppText>
        <AppText variant="title1" align="center" accessibilityRole="header">
          Your journey starts here.
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          90 days. One summit.
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[6] },
  art: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface.warm },
  text: { gap: spacing[2], alignItems: 'center' },
});
