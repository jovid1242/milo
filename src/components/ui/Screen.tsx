import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Wraps the content in a scroll view with keyboard-friendly defaults. */
  scroll?: boolean;
  background?: 'base' | 'warm';
  edges?: readonly Edge[];
  /** Horizontal screen padding (design-system: 20pt). */
  padded?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Drawn above the content and never touchable, e.g. a celebration effect. */
  overlay?: ReactNode;
  testID?: string;
};

export function Screen({
  children,
  scroll = false,
  background = 'base',
  edges = ['top'],
  padded = true,
  contentContainerStyle,
  overlay,
  testID,
}: ScreenProps) {
  const contentStyle = [padded && styles.padded, contentContainerStyle];

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.safeArea, { backgroundColor: colors.background[background] }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
      {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  content: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingBottom: spacing[10],
  },
  padded: { paddingHorizontal: layout.screenPaddingX },
});
