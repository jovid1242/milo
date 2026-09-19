import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { GrammarRule } from '@/schemas';
import { spacing } from '@/theme';

/** The keepsake of a Grammar quest: the rule you now know. */
export function RuleLearned({ rule }: { rule: GrammarRule }) {
  return (
    <View style={styles.block} accessible accessibilityLabel={`Rule learned: ${rule.title}`}>
      <AppText variant="overline" color="tertiary" align="center">
        Rule learned
      </AppText>
      <AppText variant="title2" align="center">
        {rule.title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[1] },
});
