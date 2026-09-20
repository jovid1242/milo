import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

/** Step one: who is walking next to you for the next ninety days. */
export function MeetMilo() {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.step} testID="onboarding-welcome">
      <Animated.View entering={FadeIn.duration(durations.slow)}>
        <AssetImage
          asset={mascots.idle}
          width={clamp(Math.round(width * 0.56), 180, 260)}
          accessibilityLabel="Milo, a small bear with a backpack"
        />
      </Animated.View>
      <Animated.View entering={FadeInUp.duration(durations.normal).delay(140)} style={styles.text}>
        <AppText variant="overline" color="wood" align="center">
          90 Day English Challenge
        </AppText>
        <AppText variant="title1" align="center" accessibilityRole="header">
          Hi, I&apos;m Milo.
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          {'We walk this road together.\nA little English every day — that’s the whole idea.'}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
  text: { gap: spacing[2], alignItems: 'center' },
});
