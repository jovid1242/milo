import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { ExamPassage as Passage } from '@/schemas';
import { colors, layout, radius, spacing } from '@/theme';

export type ExamPassageProps = {
  passage: Passage;
  /** Open on its first question; folded on the next ones, one tap away. */
  open: boolean;
  onToggle: () => void;
};

/** The text reading questions refer to, right above them. */
export function ExamPassage({ passage, open, onToggle }: ExamPassageProps) {
  const toggleLabel = open ? 'Hide the text' : 'Show the text';
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.card} testID="exam-passage">
      <View style={styles.head}>
        <BookOpen size={18} strokeWidth={2} color={colors.wood.base} />
        <AppText variant="bodyStrong" style={styles.title}>
          {passage.title}
        </AppText>
      </View>
      <AppText
        variant={open ? 'reading' : 'body'}
        color={open ? 'primary' : 'secondary'}
        numberOfLines={open ? undefined : 2}>
        {passage.text}
      </AppText>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${toggleLabel}: ${passage.title}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.toggle}
        testID="exam-passage-toggle">
        <AppText variant="label" color="brand">
          {toggleLabel}
        </AppText>
        <Chevron size={16} strokeWidth={2.5} color={colors.brand.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[2],
    paddingTop: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    minHeight: layout.minTouchTarget,
  },
});
