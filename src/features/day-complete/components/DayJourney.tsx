import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { tomorrowLabel } from '@/features/challenge/logic/tomorrow';
import { SummitTrail } from '@/features/today/components/SummitTrail';
import { colors, radius, spacing } from '@/theme';

import type { DaySequence } from '../hooks/use-day-sequence';
import type { DaySummary } from '../use-cases';

const daysLeftLabel = (days: number) =>
  days === 0 ? 'Summit reached' : `${days} ${days === 1 ? 'day' : 'days'} to the summit`;

/**
 * Where the day leaves the expedition: the 90-day trail (the walked part grows
 * by today as the streak steps up) and a look at tomorrow — no more than a look.
 */
export function DayJourney({
  summary,
  sequence,
  summitWidth,
}: {
  summary: DaySummary;
  sequence: DaySequence;
  summitWidth: number;
}) {
  const stepped = sequence.reached('streak');
  const walked = stepped ? summary.completedDays : Math.max(0, summary.completedDays - 1);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText variant="overline" color="wood">
          Journey
        </AppText>
        <AppText variant="label" color="secondary">
          {`${walked}/${summary.totalDays}`}
        </AppText>
      </View>
      <SummitTrail
        day={summary.day}
        totalDays={summary.totalDays}
        completedDays={walked}
        checkpointDays={summary.checkpointDays}
        isTodayComplete={stepped}
        celebrateKey={stepped && sequence.animated ? summary.day : null}
        summitWidth={summitWidth}
      />
      <AppText variant="caption" color="secondary">
        {daysLeftLabel(summary.daysToSummit)}
      </AppText>
      {summary.tomorrow ? (
        <View style={styles.tomorrow}>
          <AppText variant="label" color="wood">
            {tomorrowLabel(summary.tomorrow)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[2] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tomorrow: {
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surface.warm,
  },
});
