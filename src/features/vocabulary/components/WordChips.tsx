import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/** The words of this quest, as small keepsakes. */
export function WordChips({ words }: { words: readonly string[] }) {
  return (
    <View style={styles.block}>
      <AppText variant="overline" color="tertiary" align="center">
        Your new words
      </AppText>
      <View
        style={styles.chips}
        accessible
        accessibilityLabel={`Your new words: ${words.join(', ')}`}>
        {words.map((word) => (
          <View key={word} style={styles.chip}>
            <AppText variant="label" color="wood">
              {word}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.warm,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
});
