import { StyleSheet, View } from 'react-native';

import { AppText, ProgressBar } from '@/components/ui';
import type { Journey } from '@/schemas';
import { colors, layout, spacing } from '@/theme';

import { daysToSummitLabel } from '../logic/day-copy';

/** Compact: where the user is and how far they have walked — the map is the focus. */
export function JourneyHeader({ journey }: { journey: Journey }) {
  const { currentDay, totalDays, completedDays, isComplete } = journey;
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <AppText variant="title1" accessibilityRole="header">
          Journey
        </AppText>
        <AppText variant="label" color={isComplete ? 'reward' : 'secondary'}>
          {isComplete ? 'Journey completed' : `Day ${currentDay} of ${totalDays}`}
        </AppText>
      </View>
      <ProgressBar
        progress={completedDays / totalDays}
        height={6}
        accessibilityLabel={`${completedDays} of ${totalDays} days completed`}
      />
      <AppText variant="caption" color="secondary">
        {isComplete
          ? `${totalDays} of ${totalDays} days completed`
          : `${completedDays} of ${totalDays} days completed · ${daysToSummitLabel(currentDay, totalDays)}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.warm,
    backgroundColor: colors.background.warm,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
