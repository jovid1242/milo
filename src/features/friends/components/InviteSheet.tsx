import * as Clipboard from 'expo-clipboard';
import { Copy, Share2 } from 'lucide-react-native';
import { useEffect, useEffectEvent, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import { logger } from '@/lib/logger';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, radius, spacing } from '@/theme';

import { useCreateInvite } from '../queries';

/**
 * The invite, as it will work with a server: a code to share. Today it is a
 * local demo — the sheet says so instead of pretending a friend can join.
 */
export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const createInvite = useCreateInvite();
  const [copied, setCopied] = useState(false);
  const invite = createInvite.data;

  // Asking for the invite creates the team the first time; later it is the same code.
  const request = useEffectEvent(() => {
    if (!createInvite.isPending) createInvite.mutate();
  });
  useEffect(() => {
    if (visible) request();
  }, [visible]);

  // "Copied" belongs to one showing of the sheet.
  const close = () => {
    setCopied(false);
    onClose();
  };

  const copy = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.code);
    triggerHaptic('selection');
    setCopied(true);
  };

  const share = () => {
    if (!invite) return;
    Share.share({
      message: `Join my 90-day English challenge on Milo. Our team code: ${invite.code}`,
    }).catch((error: unknown) => logger.warn('could not open the share sheet', error));
  };

  return (
    <Sheet visible={visible} onClose={close} closeLabel="Close invite">
      <View style={styles.body} testID="invite-sheet">
        <View style={styles.titles}>
          <AppText variant="overline" color="wood">
            Invite friend
          </AppText>
          <AppText variant="title2" accessibilityRole="header">
            Invite to your challenge
          </AppText>
          <AppText variant="body" color="secondary">
            Climb the same 90 days together: a team streak grows on the days everyone finishes.
          </AppText>
        </View>

        <View
          style={styles.code}
          accessible
          accessibilityLabel={`Challenge code ${invite?.code.split('').join(' ') ?? 'loading'}`}>
          <AppText variant="overline" color="tertiary">
            Challenge code
          </AppText>
          <AppText variant="display" selectable style={styles.codeText}>
            {invite?.code ?? '…'}
          </AppText>
        </View>

        <View style={styles.actions}>
          <Button
            label={copied ? 'Copied' : 'Copy code'}
            icon={Copy}
            variant="secondary"
            onPress={() => void copy()}
            disabled={!invite}
            haptic={null}
            fullWidth
          />
          <Button label="Share invite" icon={Share2} onPress={share} disabled={!invite} fullWidth />
        </View>

        {invite && !invite.joinable ? (
          <AppText variant="caption" color="secondary" align="center" style={styles.note}>
            {`Demo for now: joining from another phone needs Milo's online sync, which isn't live yet. Your code stays the same for when it is.`}
          </AppText>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[5] },
  titles: { gap: spacing[1] },
  code: {
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.warm,
    borderWidth: 1,
    borderColor: colors.border.warm,
    borderStyle: 'dashed',
  },
  codeText: { letterSpacing: 2 },
  actions: { gap: spacing[2] },
  note: { paddingHorizontal: spacing[2] },
});
