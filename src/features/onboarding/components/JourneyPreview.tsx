import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { journey } from '@/constants/assets';
import { DottedTrail } from '@/features/today/components/DottedTrail';
import { colors, durations, radius, spacing } from '@/theme';

/** The places the trail passes, one per chapter — named, not mapped. */
const STOPS = ['Camp', 'Forest', 'River', 'Mountains', 'Summit'] as const;
const MARKER_BOX = 32;

/** Step two: where the ninety days lead, without the whole map. */
export function JourneyPreview() {
  const { height } = useWindowDimensions();
  const sceneHeight = Math.round(Math.min(height * 0.24, 210));

  return (
    <View style={styles.step} testID="onboarding-journey">
      <Animated.View
        entering={FadeIn.duration(durations.slow)}
        style={[styles.scene, { height: sceneHeight }]}>
        <Image
          source={journey.background.source}
          contentFit="cover"
          contentPosition="bottom"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(durations.normal).delay(120)} style={styles.text}>
        <AppText variant="title2" align="center" accessibilityRole="header">
          {'90 days.\nOne step at a time.'}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          Every day, you’ll complete a few short English quests and move closer to the summit.
        </AppText>
      </Animated.View>

      <View
        style={styles.trail}
        accessible
        accessibilityLabel="The trail: camp, forest, river, mountains and the summit, from Day 1 to Day 90">
        <View style={styles.line}>
          <DottedTrail orientation="horizontal" color={colors.trail.ahead} />
        </View>
        {STOPS.map((stop, index) => {
          const first = index === 0;
          const last = index === STOPS.length - 1;
          return (
            // The path reveals itself stop by stop, camp to summit.
            <Animated.View
              key={stop}
              entering={FadeIn.duration(durations.normal).delay(320 + index * 110)}
              style={styles.stop}>
              <View style={styles.marker}>
                {last ? (
                  <AssetImage asset={journey.flagSmall} width={22} />
                ) : (
                  <View style={[styles.dot, first && styles.dotStart]} />
                )}
              </View>
              <AppText
                variant="caption"
                color={first ? 'brand' : 'primary'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {stop}
              </AppText>
              <AppText variant="caption" color="tertiary">
                {first ? 'Day 1' : last ? 'Day 90' : ' '}
              </AppText>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  scene: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface.warm,
  },
  text: { gap: spacing[2] },
  trail: { flexDirection: 'row' },
  // From the first stop's centre to the last one's: half a column in from each side.
  line: { position: 'absolute', left: '10%', right: '10%', top: 0, height: MARKER_BOX },
  stop: { flex: 1, alignItems: 'center', gap: spacing[1] },
  marker: { height: MARKER_BOX, justifyContent: 'center', alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.trail.ahead,
    backgroundColor: colors.background.base,
  },
  dotStart: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: colors.brand.primary,
  },
});
