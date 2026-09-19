import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton, SegmentedProgress } from '@/components/ui';
import { spacing } from '@/theme';

export type QuestTopBarProps = {
  title: string;
  /** Small step text on the right, e.g. "3 of 6". */
  stepLabel: string;
  /** Progress segments per phase, e.g. `[4, 6]`: learning, then practice. */
  groups: readonly number[];
  done: number;
  onClose: () => void;
};

/** Gameplay header: leave, what this is, and how far along — nothing else. */
export function QuestTopBar({ title, stepLabel, groups, done, onClose }: QuestTopBarProps) {
  const total = groups.reduce((sum, count) => sum + count, 0);
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {/* Centred on the screen, not between the side items, so it never shifts. */}
        <View style={styles.titleLayer}>
          <AppText variant="overline" color="wood" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
        </View>
        <IconButton
          icon={X}
          accessibilityLabel="Leave quest"
          onPress={onClose}
          style={styles.close}
          testID="quest-close"
        />
        <AppText variant="label" color="secondary" numberOfLines={1} style={styles.step}>
          {stepLabel}
        </AppText>
      </View>
      {total > 0 ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${title} progress`}
          accessibilityValue={{ min: 0, max: total, now: done }}>
          <SegmentedProgress groups={groups} done={done} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The bottom padding keeps scrolled content from being cut right at the progress bar.
  bar: { gap: spacing[2], paddingTop: spacing[1], paddingBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  close: { marginLeft: -spacing[3] },
  // Up to a third of the bar: never runs into the centred title.
  step: { maxWidth: '34%', textAlign: 'right' },
});
