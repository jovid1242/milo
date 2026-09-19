import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, PressableScale } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { colors, durations, radius, spacing } from '@/theme';

export type ThinkFirstHintProps = {
  title: string;
  message: string;
  accessibilityLabel: string;
  onReveal: () => void;
};

/**
 * Milo thinking, and a gentle nudge to recall before checking — recalling
 * first is what makes things stick. Tapping it reveals the answer.
 */
export function ThinkFirstHint({
  title,
  message,
  accessibilityLabel,
  onReveal,
}: ThinkFirstHintProps) {
  return (
    <Animated.View entering={FadeIn.duration(durations.normal).delay(80)}>
      <PressableScale
        onPress={onReveal}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.hint}>
        <AssetImage asset={mascots.thinking} width={72} />
        <View style={styles.text}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color="secondary">
            {message}
          </AppText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border.warm,
    backgroundColor: colors.surface.warm,
  },
  text: { flex: 1, gap: 2 },
});
