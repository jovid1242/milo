import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type ExamOptionProps = {
  /** A, B, C, D. */
  letter: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * One choice in the exam. Choosing it only marks it as yours — right and wrong
 * wait until the exam is handed in. Neutral wood tones (not the green and red
 * of answer feedback), and chosen is more than a color: a filled letter and a
 * thicker border.
 */
export function ExamOption({ letter, label, selected, onPress, testID }: ExamOptionProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={`${letter}. ${label}`}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : styles.optionIdle]}>
      <View style={[styles.letter, selected ? styles.letterSelected : styles.letterIdle]}>
        <AppText variant="label" color={selected ? 'inverse' : 'wood'}>
          {letter}
        </AppText>
      </View>
      <AppText variant={selected ? 'bodyStrong' : 'bodyLarge'} style={styles.label}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const LETTER = 28;

const styles = StyleSheet.create({
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  optionIdle: {
    backgroundColor: colors.surface.base,
    borderWidth: 1.5,
    borderColor: colors.border.warm,
  },
  optionSelected: {
    backgroundColor: colors.surface.warm,
    borderWidth: 2.5,
    borderColor: colors.wood.dark,
  },
  letter: {
    width: LETTER,
    height: LETTER,
    borderRadius: LETTER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterIdle: { borderWidth: 1.5, borderColor: colors.wood.light },
  letterSelected: { backgroundColor: colors.wood.dark },
  label: { flex: 1 },
});
