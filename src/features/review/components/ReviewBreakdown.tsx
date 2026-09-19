import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import type { ReviewResult, ReviewSource } from '@/schemas';
import { colors, radius, spacing } from '@/theme';

import { SOURCE_LABELS } from '../logic/review-items';

/** How today's words, rule and story held up — the review's keepsake. */
export function ReviewBreakdown({
  result,
  sources,
}: {
  result: ReviewResult;
  sources: readonly ReviewSource[];
}) {
  return (
    <View style={styles.card}>
      {sources.map((source, index) => {
        const { correct, total } = result.bySource[source];
        return (
          <View
            key={source}
            style={[styles.row, index > 0 && styles.divided]}
            accessible
            accessibilityLabel={`${SOURCE_LABELS[source]}: ${correct} of ${total} right`}>
            <QuestIcon type={source} size={28} />
            <AppText variant="bodyStrong" style={styles.label}>
              {SOURCE_LABELS[source]}
            </AppText>
            <AppText variant="label" color={correct === total ? 'brand' : 'secondary'}>
              {`${correct}/${total}`}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
  label: { flex: 1 },
});
