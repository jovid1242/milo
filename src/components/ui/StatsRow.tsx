import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, spacing } from '@/theme';

export type Stat = { label: string; value: string };

/** Numbers with dividers instead of four separate cards. */
export function StatsRow({ stats }: { stats: readonly Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.item}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <AppText variant="statNumber">{stat.value}</AppText>
          <AppText variant="caption" color="tertiary">
            {stat.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', gap: spacing[1] },
  separator: {
    position: 'absolute',
    left: 0,
    top: spacing[1],
    bottom: spacing[1],
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
});
