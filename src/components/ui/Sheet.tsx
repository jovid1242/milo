import { useEffect, useState, type ReactNode } from 'react';
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

export type SheetProps = {
  visible: boolean;
  /** Backdrop tap and Android back. */
  onClose: () => void;
  /** Read by screen readers for the backdrop, e.g. "Close". */
  closeLabel: string;
  children: ReactNode;
};

/**
 * A calm bottom sheet in a transparent modal, so it covers the whole screen
 * from any layout. Slides up, fades its backdrop, and stays mounted while it
 * closes so the exit animates too.
 */
export function Sheet({ visible, onClose, closeLabel, children }: SheetProps) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
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
    transform: [{ translateY: (1 - shown.get()) * 360 }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }, sheetStyle]}>
        <View style={styles.handle} />
        {children}
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
});
