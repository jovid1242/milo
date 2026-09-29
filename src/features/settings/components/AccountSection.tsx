import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ConfirmSheet } from '@/components/ui';
import { useAccount, useSignOut } from '@/features/auth/queries';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import { spacing } from '@/theme';

/** Who is signed in, and the way out. Progress stays on the device either way. */
export function AccountSection() {
  const saved = useAuthStore((state) => state.account);
  const account = useAccount();
  const signOut = useSignOut();
  const [confirming, setConfirming] = useState(false);
  const email = account.data?.email ?? saved?.email;

  return (
    <View style={styles.section}>
      <View style={styles.who} accessible accessibilityLabel={`Signed in as ${email ?? ''}`}>
        <AppText variant="caption" color="secondary">
          Signed in as
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1} testID="settings-account-email">
          {email ?? '—'}
        </AppText>
      </View>
      <Button
        label="Log out"
        icon={LogOut}
        variant="secondary"
        size="md"
        loading={signOut.isPending}
        onPress={() => setConfirming(true)}
        testID="settings-log-out"
      />
      <ConfirmSheet
        visible={confirming}
        title="Log out?"
        message="Your progress stays on this iPhone. Log in again any time to carry on."
        stayLabel="Stay logged in"
        leaveLabel="Log out"
        onStay={() => setConfirming(false)}
        onLeave={() => {
          setConfirming(false);
          signOut.mutate(undefined, {
            onError: (error: unknown) => logger.warn('logging out did not finish cleanly', error),
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3], paddingVertical: spacing[2] },
  who: { gap: spacing[1] },
});
