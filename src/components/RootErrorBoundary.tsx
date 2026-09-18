import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, layout } from '@/theme';

import { ErrorState } from './ErrorState';

/** Rendered by Expo Router when a route throws during render. */
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <ErrorState
        title="Milo hit a snag"
        message="The screen could not be displayed."
        error={error}
        onRetry={() => void retry()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
    paddingHorizontal: layout.screenPaddingX,
    justifyContent: 'center',
  },
});
