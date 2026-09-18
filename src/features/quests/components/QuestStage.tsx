import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

export type QuestStageProps = {
  children: ReactNode;
  /** Pinned to the bottom, above the home indicator: the one action (or feedback). */
  footer?: ReactNode;
  /** Centre short content vertically (intro, result). */
  centered?: boolean;
};

/**
 * Layout of every gameplay step: content that may scroll (large text sizes),
 * with the action always reachable at the bottom.
 */
export function QuestStage({ children, footer, centered = false }: QuestStageProps) {
  return (
    <View style={styles.stage}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, centered && styles.centered]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: spacing[8], paddingBottom: spacing[6], gap: spacing[6] },
  centered: { justifyContent: 'center', paddingTop: spacing[4] },
  footer: { paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[3] },
});
