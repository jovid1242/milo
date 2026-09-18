import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Wraps the content in a scroll view with keyboard-friendly defaults. */
  scroll?: boolean;
  background?: 'base' | 'warm';
  edges?: readonly Edge[];
  /**
   * Presented as a full-screen modal. The native safe-area view reports no top
   * inset there (content would slide under the status bar and Dynamic Island),
   * so the window's insets are applied instead.
   */
  fullScreenModal?: boolean;
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
  fullScreenModal = false,
  padded = true,
  contentContainerStyle,
  overlay,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const contentStyle = [padded && styles.padded, contentContainerStyle];
  const backgroundStyle = { backgroundColor: colors.background[background] };

  const content = (
    <>
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
    </>
  );

  if (fullScreenModal) {
    return (
      <View
        testID={testID}
        style={[
          styles.safeArea,
          backgroundStyle,
          {
            paddingTop: edges.includes('top') ? insets.top : 0,
            paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
            paddingLeft: edges.includes('left') ? insets.left : 0,
            paddingRight: edges.includes('right') ? insets.right : 0,
          },
        ]}>
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView testID={testID} edges={edges} style={[styles.safeArea, backgroundStyle]}>
      {content}
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
