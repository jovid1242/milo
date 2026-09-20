import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { journey } from '@/constants/assets';
import { CHAPTERS } from '@/data/content/chapters';
import { colors, durations, radius, spacing } from '@/theme';

/** Step two: the shape of the ninety days, chapter by chapter. */
export function JourneyPreview() {
  const { height } = useWindowDimensions();
  const sceneHeight = Math.round(Math.min(height * 0.24, 220));

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
          Ninety days, five chapters.
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          The trail starts at camp and ends on the summit. Every day you walk is a step on the map.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(240)} style={styles.list}>
        {CHAPTERS.map((chapter) => (
          <View
            key={chapter.id}
            style={styles.row}
            accessible
            accessibilityLabel={`Chapter ${chapter.number}, ${chapter.title}, days ${chapter.startDay} to ${chapter.endDay}`}>
            <AppText variant="overline" color="wood" style={styles.number}>
              {String(chapter.number).padStart(2, '0')}
            </AppText>
            <AppText variant="bodyMedium" style={styles.title}>
              {chapter.title}
            </AppText>
            <AppText variant="caption" color="secondary">
              {chapter.startDay === chapter.endDay
                ? `Day ${chapter.startDay}`
                : `Days ${chapter.startDay}–${chapter.endDay}`}
            </AppText>
          </View>
        ))}
      </Animated.View>
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
  list: { gap: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
  number: { width: 24 },
  title: { flex: 1 },
});
