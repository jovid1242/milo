import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Share2 } from 'lucide-react-native';
import { useEffect, useEffectEvent, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import { logger } from '@/lib/logger';
import type { TeamInvite } from '@/schemas';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, radius, spacing } from '@/theme';

import type { TeamView } from '../logic/team';
import { inviteExpiry, inviteShareMessage } from '../logic/team-copy';
import { teamProblemOf } from '../logic/team-errors';
import { useRenewInvite, useTeamInvite } from '../queries';
import { TeamNotice } from './TeamNotice';

/**
 * The team's invite: a code to read out and a link that opens Milo on it,
 * shared through the system share sheet. The server makes it (and checks it
 * is still open each time the sheet opens); offline, the last known one is
 * shown while it lasts.
 */
export function InviteSheet({
  visible,
  onClose,
  view,
}: {
  visible: boolean;
  onClose: () => void;
  view: TeamView;
}) {
  const request = useTeamInvite();
  const renew = useRenewInvite();
  const [copied, setCopied] = useState(false);
  const invite: TeamInvite | null = renew.data ?? request.data ?? view.invite;
  const me = view.members.find((member) => member.isCurrentUser);
  const canRenew = invite !== null && (me?.isOwner === true || invite.createdBy === me?.userId);
  const failure = renew.error ?? request.error;

  // Each time it opens: the open invite, or a new one when there is none.
  const ask = useEffectEvent(() => {
    if (!request.isPending) request.mutate(view.id);
  });
  useEffect(() => {
    if (visible) ask();
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
    Share.share({ message: inviteShareMessage(invite.code) }).catch((error: unknown) =>
      logger.warn('could not open the share sheet', error),
    );
  };

  const newCode = () => {
    if (!invite) return;
    setCopied(false);
    renew.mutate({ teamId: view.id, inviteId: invite.id });
  };

  return (
    <Sheet visible={visible} onClose={close} closeLabel="Close invite">
      <View style={styles.body} testID="invite-sheet">
        <View style={styles.titles}>
          <AppText variant="overline" color="wood">
            Invite friends
          </AppText>
          <AppText variant="title2" accessibilityRole="header">
            Invite to your team
          </AppText>
          <AppText variant="body" color="secondary">
            A team is three friends on the same 90 days: the team streak grows on the days everyone
            finishes.
          </AppText>
        </View>

        <View
          style={styles.code}
          accessible
          accessibilityLabel={`Invite code ${invite?.code.split('').join(' ') ?? 'loading'}`}>
          <AppText variant="overline" color="tertiary">
            Invite code
          </AppText>
          <AppText variant="title1" selectable style={styles.codeText} testID="invite-code">
            {invite?.code ?? '…'}
          </AppText>
          {invite ? (
            <AppText variant="caption" color="tertiary">
              {inviteExpiry(invite.expiresAt)}
            </AppText>
          ) : null}
        </View>

        {failure && !(invite && teamProblemOf(failure) === 'offline') ? (
          <TeamNotice problem={teamProblemOf(failure)} />
        ) : null}

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
          <Button
            label="Share invite"
            icon={Share2}
            onPress={share}
            disabled={!invite}
            fullWidth
            testID="invite-share"
          />
          {canRenew ? (
            <Button
              label="New code"
              icon={RefreshCw}
              variant="ghost"
              size="sm"
              onPress={newCode}
              loading={renew.isPending}
              style={styles.renew}
            />
          ) : null}
        </View>
        {canRenew ? (
          <AppText variant="caption" color="tertiary" align="center">
            A new code turns this one off.
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
  renew: { alignSelf: 'center' },
});
