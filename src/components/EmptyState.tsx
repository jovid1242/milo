import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { emptyStates, type EmptyStateKey } from '@/constants/assets';
import { spacing } from '@/theme';

import { AssetImage } from './AssetImage';
import { AppText, Button } from './ui';

export type EmptyStateProps = {
  /** Uses the matching illustration: no-internet, no-friends-yet, nothing-to-review. */
  variant: EmptyStateKey;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void; loading?: boolean; testID?: string };
  /** A second, quieter way on (under the first). */
  secondaryAction?: { label: string; onPress: () => void; testID?: string };
  /** Under the actions: a note, or why one did not work. */
  footer?: ReactNode;
};

export function EmptyState({
  variant,
  title,
  description,
  action,
  secondaryAction,
  footer,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AssetImage asset={emptyStates[variant]} width={220} />
      <View style={styles.text}>
        <AppText variant="title2" align="center">
          {title}
        </AppText>
        {description ? (
          <AppText variant="body" color="secondary" align="center">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          loading={action.loading}
          size="md"
          variant={secondaryAction ? 'primary' : 'secondary'}
          style={styles.action}
          testID={action.testID}
        />
      ) : null}
      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          size="md"
          variant="ghost"
          style={styles.secondary}
          testID={secondaryAction.testID}
        />
      ) : null}
      {footer}
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
  action: { alignSelf: 'center' },
  secondary: { alignSelf: 'center', marginTop: -spacing[3] },
});
