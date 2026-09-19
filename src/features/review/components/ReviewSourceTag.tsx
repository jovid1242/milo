import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import type { ReviewSource } from '@/schemas';
import { spacing } from '@/theme';

import { SOURCE_LABELS } from '../logic/review-items';

/** Which of today's quests a review question comes back to — with that quest's icon. */
export function ReviewSourceTag({ source }: { source: ReviewSource }) {
  return (
    <View
      style={styles.tag}
      accessible
      accessibilityLabel={`From today's ${SOURCE_LABELS[source]} quest`}>
      <QuestIcon type={source} size={22} />
      <AppText variant="label" color="secondary">
        {SOURCE_LABELS[source]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
});
