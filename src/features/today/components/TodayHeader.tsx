import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { durations, spacing } from '@/theme';

import type { HomeMoment } from '../hooks/use-journey-moments';
import type { TodayJourney } from '../logic/today-journey';
import { StreakChip } from './StreakChip';
import { SummitTrail } from './SummitTrail';
import { XpCounter } from './XpCounter';

export type TodayHeaderProps = {
  journey: TodayJourney;
  moment: HomeMoment | null;
  /** Short screens (iPhone SE class): a smaller title leaves room for today's quest. */
  compact: boolean;
};

function summitLabel(daysToSummit: number): string {
  if (daysToSummit === 0) return 'Summit day';
  return daysToSummit === 1 ? '1 day to the summit' : `${daysToSummit} days to the summit`;
}

/** Day, chapter, streak and the 90-day trail — the whole status in one glance. */
export function TodayHeader({ journey, moment, compact }: TodayHeaderProps) {
  const { chapter, day, totalDays } = journey;
  const streakGrew = moment !== null && moment.streakTo > moment.streakFrom;
  const xpGrew = moment !== null && moment.xpTo > moment.xpFrom;

  return (
    <Animated.View entering={FadeIn.duration(durations.normal)} style={styles.header}>
      <View style={styles.topRow}>
        <AppText variant="overline" color="wood">
          {`Chapter ${String(chapter.number).padStart(2, '0')} · ${chapter.title}`}
        </AppText>
        <StreakChip
          streak={journey.streak}
          bump={
            streakGrew
              ? { key: moment.id, from: moment.streakFrom, delayMs: moment.streakDelayMs }
              : null
          }
        />
      </View>

      <View accessible accessibilityRole="header" style={styles.titleRow}>
        <AppText variant={compact ? 'display' : 'displayLarge'}>{`Day ${day}`}</AppText>
        <AppText variant="bodyLarge" color="tertiary">
          {`of ${totalDays}`}
        </AppText>
      </View>

      <View style={styles.trail}>
        <SummitTrail
          day={day}
          totalDays={totalDays}
          completedDays={journey.completedDays}
          checkpointDays={journey.checkpointDays}
          isTodayComplete={journey.isComplete}
          celebrateKey={moment?.dayCompleted ? moment.id : null}
          summitWidth={compact ? 44 : 56}
        />
        <View style={styles.captionRow}>
          <AppText variant="caption" color="secondary">
            {summitLabel(journey.daysToSummit)}
          </AppText>
          <XpCounter
            value={journey.totalXp}
            gain={xpGrew ? { key: moment.id, from: moment.xpFrom, to: moment.xpTo } : null}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing[2] },
  trail: { gap: spacing[1], marginTop: spacing[1] },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
