import { StyleSheet, View } from 'react-native';

import { mascots } from '@/constants/assets';
import { spacing } from '@/theme';

import { AssetImage } from './AssetImage';
import { AppText, Button } from './ui';

export type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Shown in development to make debugging quicker. */
  error?: unknown;
};

export function ErrorState({
  title = 'Something went wrong',
  message = 'The screen could not load. Please try again.',
  onRetry,
  error,
}: ErrorStateProps) {
  const details = __DEV__ && error instanceof Error ? error.message : null;

  return (
    <View style={styles.container}>
      <AssetImage asset={mascots.thinking} width={180} />
      <View style={styles.text}>
        <AppText variant="title2" align="center">
          {title}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {message}
        </AppText>
        {details ? (
          <AppText variant="caption" color="tertiary" align="center">
            {details}
          </AppText>
        ) : null}
      </View>
      {onRetry ? <Button label="Try again" onPress={onRetry} size="md" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingVertical: spacing[10],
  },
  text: { gap: spacing[2], alignItems: 'center', maxWidth: 320 },
});
