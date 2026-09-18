import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton, SegmentedProgress } from '@/components/ui';
import { spacing } from '@/theme';

export type QuestTopBarProps = {
  title: string;
  /** Small step text on the right, e.g. "3 of 6". */
  stepLabel: string;
  /** Progress segments per phase, e.g. `[6, 6]`. */
  groups: readonly number[];
  done: number;
  onClose: () => void;
};

const SIDE = 76;

/** Gameplay header: leave, what this is, and how far along — nothing else. */
export function QuestTopBar({ title, stepLabel, groups, done, onClose }: QuestTopBarProps) {
  const total = groups.reduce((sum, count) => sum + count, 0);
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <View style={styles.side}>
          <IconButton
            icon={X}
            accessibilityLabel="Leave quest"
            onPress={onClose}
            style={styles.close}
            testID="quest-close"
          />
        </View>
        <AppText variant="overline" color="wood" accessibilityRole="header">
          {title}
        </AppText>
        <View style={[styles.side, styles.right]}>
          <AppText variant="label" color="secondary">
            {stepLabel}
          </AppText>
        </View>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${title} progress`}
        accessibilityValue={{ min: 0, max: total, now: done }}>
        <SegmentedProgress groups={groups} done={done} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: spacing[2], paddingTop: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: SIDE },
  right: { alignItems: 'flex-end' },
  close: { marginLeft: -spacing[3] },
});
