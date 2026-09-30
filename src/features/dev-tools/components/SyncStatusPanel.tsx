import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import type { OutboxEntry } from '@/data/repositories/types';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { spacing } from '@/theme';

const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

const describeEntry = (entry: OutboxEntry) =>
  [
    `${entry.type ?? 'unreadable'} · ${entry.status}`,
    `  ${entry.mutationId.slice(0, 8)} · made ${time(entry.createdAt)} · tried ${entry.attemptCount}×`,
    entry.errorCode
      ? `  ${entry.errorCode}${entry.errorMessage ? `: ${entry.errorMessage}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

/**
 * The account's progress sync, for development: who, which revision, what
 * waits, how the last sync went — and a way to sync now or read the outbox.
 * Nothing here changes progress: that is the server's to decide.
 */
export function SyncStatusPanel() {
  const session = useAuthStore((state) => state.session);
  const status = useSyncStore((state) => state.status);
  const engine = session?.engine ?? null;
  const sync = session?.repositories.sync ?? null;

  if (!engine || !sync) {
    return (
      <AppText variant="caption" color="secondary">
        Local mode: progress is this device&apos;s own, nothing to sync.
      </AppText>
    );
  }

  const inspect = () => {
    sync.repository
      .outbox()
      .then((entries) =>
        Alert.alert(
          `Outbox · ${entries.length}`,
          entries.length === 0
            ? 'Empty: the server has everything.'
            : entries.map(describeEntry).join('\n\n'),
        ),
      )
      .catch((error: unknown) => logger.warn('the outbox could not be read', error));
  };

  return (
    <View style={styles.panel} testID="dev-sync-status">
      <AppText variant="caption" color="secondary">
        {`Account: ${sync.accountId}`}
      </AppText>
      <AppText variant="caption" color="secondary">
        {status
          ? `Revision ${status.revision} · ${status.pending} waiting · ${status.rejected} refused · ${status.state}`
          : 'Not synced yet'}
      </AppText>
      <AppText variant="caption" color="secondary">
        {`Last sync ${time(status?.lastSyncedAt ?? null)} · last try ${time(status?.lastAttemptAt ?? null)}`}
      </AppText>
      {status?.error ? (
        <AppText variant="caption" color="danger">
          {status.error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Sync now"
          size="sm"
          variant="secondary"
          haptic={null}
          onPress={() => void engine.requestSync('manual')}
        />
        <Button
          label="Inspect outbox"
          size="sm"
          variant="secondary"
          haptic={null}
          onPress={inspect}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing[1] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
});
