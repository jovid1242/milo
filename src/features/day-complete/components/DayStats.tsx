import { Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, SegmentedProgress } from '@/components/ui';
import { effects } from '@/constants/assets';
import { useCountUp } from '@/hooks/use-count-up';
import type { DayCompletion } from '@/schemas';
import { colors, radius, spacing, springs } from '@/theme';
import { formatNumber } from '@/utils/number';

import type { DaySequence } from '../hooks/use-day-sequence';

/**
 * The day in three numbers: the quests resolving to 4/4, the XP counting up,
 * the streak stepping from yesterday's number to today's.
 */
export function DayStats({ record, sequence }: { record: DayCompletion; sequence: DaySequence }) {
  const questsDone = sequence.reached('quests') ? record.questCount : record.questCount - 1;
  const xpReached = sequence.reached('xp');
  const xp = useCountUp(
    xpReached ? record.xpEarned : 0,
    xpReached && sequence.animated ? { key: 'day-xp', from: 0, to: record.xpEarned } : null,
    { delayMs: 0, durationMs: 800 },
  );
  const streakStepped = sequence.reached('streak');
  const streak = streakStepped ? record.streakAfter : record.streakBefore;

  const bump = useSharedValue(1);
  const bumpNow = streakStepped && sequence.animated;
  useEffect(() => {
    if (!bumpNow) return;
    bump.set(withSequence(withTiming(1.35, { duration: 150 }), withSpring(1, springs.bouncy)));
  }, [bumpNow, bump]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  return (
    <View style={styles.card}>
      <View
        style={styles.cell}
        accessible
        accessibilityLabel={`${questsDone} of ${record.questCount} quests`}>
        <View style={styles.icon}>
          <SegmentedProgress groups={[record.questCount]} done={questsDone} segmentWidth={12} />
        </View>
        <AppText variant="statNumber">{`${questsDone}/${record.questCount}`}</AppText>
        <AppText variant="caption" color="tertiary">
          quests
        </AppText>
      </View>

      <View style={styles.separator} />

      <View
        style={styles.cell}
        accessible
        accessibilityLabel={`${formatNumber(record.xpEarned)} XP today`}>
        <View style={styles.icon}>
          <Star size={20} color={colors.reward.goldDeep} fill={colors.reward.gold} />
        </View>
        <AppText variant="statNumber" color="reward">{`+${formatNumber(xp)}`}</AppText>
        <AppText variant="caption" color="tertiary">
          XP today
        </AppText>
      </View>

      <View style={styles.separator} />

      <View
        style={styles.cell}
        accessible
        accessibilityLabel={`${record.streakAfter} day streak, up from ${record.streakBefore}`}>
        <Animated.View style={[styles.icon, bumpStyle]}>
          <AssetImage asset={effects.streakFire} width={24} />
        </Animated.View>
        <AppText variant="statNumber">{formatNumber(streak)}</AppText>
        <AppText variant="caption" color="tertiary">
          day streak
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  cell: { flex: 1, alignItems: 'center', gap: spacing[1] },
  icon: { height: 24, justifyContent: 'center', alignItems: 'center' },
  separator: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing[1],
    backgroundColor: colors.border.subtle,
  },
});
