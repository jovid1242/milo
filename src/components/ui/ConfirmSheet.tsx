import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, durations, easings, layout, radius, shadows, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  /** The safe choice — the primary button. */
  stayLabel: string;
  /** The choice that leaves — quieter on purpose. */
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
};

/**
 * A calm bottom sheet for "are you sure?" moments (no system alert). It sits
 * in a transparent modal, so it covers the whole screen from any layout;
 * tapping the backdrop or Android back means "stay".
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  stayLabel,
  leaveLabel,
  onStay,
  onLeave,
}: ConfirmSheetProps) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
  // Stays mounted while the closing animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    const config = { duration: reduceMotion ? 0 : durations.normal, easing: easings.standard };
    shown.set(
      withTiming(visible ? 1 : 0, config, (finished) => {
        if (finished && !visible) scheduleOnRN(setMounted, false);
      }),
    );
  }, [visible, reduceMotion, shown]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.get()) * 320 }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onStay}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stayLabel}
          style={StyleSheet.absoluteFill}
          onPress={onStay}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }, sheetStyle]}>
        <View style={styles.handle} />
        <View style={styles.text}>
          <AppText variant="title2" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body" color="secondary">
            {message}
          </AppText>
        </View>
        <View style={styles.actions}>
          <Button label={stayLabel} onPress={onStay} fullWidth size="md" />
          <Button label={leaveLabel} onPress={onLeave} fullWidth size="md" variant="ghost" />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.base,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing[3],
    paddingHorizontal: layout.screenPaddingX,
    gap: spacing[5],
    ...shadows.floating,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border.default,
  },
  text: { gap: spacing[2] },
  actions: { gap: spacing[2] },
});
