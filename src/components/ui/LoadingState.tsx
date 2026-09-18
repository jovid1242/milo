import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

export type LoadingStateProps = {
  label?: string;
  /** Fills the available space instead of sitting inline. */
  fullScreen?: boolean;
};

export function LoadingState({ label, fullScreen = true }: LoadingStateProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator color={colors.brand.primary} />
      {label ? (
        <AppText variant="caption" color="tertiary">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  fullScreen: { flex: 1, paddingVertical: spacing[12] },
});
