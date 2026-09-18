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
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ variant, title, description, action }: EmptyStateProps) {
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
        <Button label={action.label} onPress={action.onPress} size="md" variant="secondary" />
      ) : null}
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
