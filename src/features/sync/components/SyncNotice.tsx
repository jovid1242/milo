import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useSyncStore } from '@/stores/sync-store';
import { colors, spacing } from '@/theme';

/**
 * A quiet line while progress waits on this phone: nothing is lost, it goes to
 * the account when it can. Nothing at all when everything is synced — or in
 * local mode, where there is nothing to sync.
 */
export function SyncNotice() {
  const status = useSyncStore((state) => state.status);
  if (!status || status.pending === 0) return null;
  const message =
    status.state === 'offline'
      ? 'Progress saved on this phone. It will sync when you’re back online.'
      : status.state === 'error'
        ? 'Progress saved on this phone. Syncing will try again shortly.'
        : status.state === 'blocked'
          ? 'Progress saved on this phone. It will sync after the next update.'
          : null;
  if (!message) return null;

  return (
    <View style={styles.row} accessibilityRole="text" testID="sync-notice">
      <CloudOff size={16} color={colors.text.secondary} />
      <AppText variant="caption" color="secondary" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  text: { flexShrink: 1 },
});
