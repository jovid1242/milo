import { BookOpen } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, layout, spacing } from '@/theme';

/** A quiet way back to the text while answering. */
export function ViewStoryButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="View the story again"
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      style={styles.button}
      testID="reading-view-story">
      <BookOpen size={18} strokeWidth={2} color={colors.brand.primary} />
      <AppText variant="label" color="brand">
        View story
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    minHeight: layout.minTouchTarget,
  },
});
