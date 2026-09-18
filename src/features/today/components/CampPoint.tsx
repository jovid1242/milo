import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { effects, journey as journeyArt } from '@/constants/assets';
import { durations, spacing } from '@/theme';

import type { TodayJourney } from '../logic/today-journey';

export type CampPointProps = {
  journey: TodayJourney;
  artWidth: number;
  /** Set when the day was just completed: the fire catches with a spark. */
  celebrateKey: number | null;
  entranceDelay: number;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Where today's trail ends. The campfire is cold until every quest is done and
 * lights up when the day is complete; on Day 90 the trail ends at the summit.
 */
export function CampPoint({ journey, artWidth, celebrateKey, entranceDelay }: CampPointProps) {
  const reduceMotion = useReducedMotion();
  const spark = useSharedValue(0);
  const { isComplete, day, totalDays } = journey;
  const summit = journey.dayKind === 'summit';
  const left = journey.steps.length - journey.completedCount;

  useEffect(() => {
    if (celebrateKey === null || reduceMotion) return;
    spark.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(250, withTiming(1, { duration: 450 })),
        withDelay(500, withTiming(0, { duration: 600 })),
      ),
    );
  }, [celebrateKey, reduceMotion, spark]);

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: spark.get(),
    transform: [{ scale: 0.85 + spark.get() * 0.2 }],
  }));

  const art = summit ? journeyArt.summit : isComplete ? journeyArt.campfire : journeyArt.campfireOff;
  const title = summit ? 'The summit' : isComplete ? 'Camp reached' : "Tonight's camp";
  const subtitle = isComplete
    ? day < totalDays
      ? `Day ${day + 1} opens tomorrow`
      : '90 days. You did it.'
    : `${plural(left, 'quest')} to go`;

  return (
    <Animated.View
      entering={FadeInDown.duration(durations.normal + 70).delay(entranceDelay)}
      layout={LinearTransition.duration(durations.normal)}
      accessible
      accessibilityLabel={`${title}. ${subtitle}.`}
      style={styles.row}>
      <View>
        <AssetImage asset={art} width={artWidth} transition={durations.reward} />
        {/* Mounted only once there is something to celebrate: no idle decoding. */}
        {celebrateKey !== null && !reduceMotion ? (
          <Animated.View style={[styles.spark, sparkStyle]}>
            <AssetImage asset={effects.sparkles} width={artWidth} />
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={isComplete ? 'brand' : 'primary'}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary">
          {subtitle}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  spark: { position: 'absolute', left: 0, top: -spacing[3] },
  text: { flex: 1, gap: 2 },
});
