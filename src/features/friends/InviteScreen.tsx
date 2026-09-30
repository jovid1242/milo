import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Users, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, IconButton, LoadingState, Screen } from '@/components/ui';
import { emptyStates } from '@/constants/assets';
import { useRepositories } from '@/data/repository-provider';
import { needsOnboarding } from '@/features/onboarding/use-cases';
import { useUser } from '@/features/profile/queries';
import type { InviteCode } from '@/schemas';
import { triggerHaptic } from '@/services/haptics/haptics';
import { useAuthStore } from '@/stores/auth-store';
import { usePendingInviteStore } from '@/stores/pending-invite-store';
import { colors, radius, spacing } from '@/theme';

import { TeamNotice } from './components/TeamNotice';
import { parseInviteInput } from './logic/invite-code';
import { inviteGate } from './logic/pending-invite';
import { previewCopy } from './logic/team-copy';
import { TEAM_PROBLEMS, teamProblemOf } from './logic/team-errors';
import { useInvitePreview, useJoinTeam } from './queries';

const FRIENDS: Href = '/friends';

/**
 * An invite, opened from a link (`milo://invite/<code>`) or a typed code. It
 * shows the team first — name, owner, size, nobody's progress — and joins only
 * when the user says so. Signed out, or before the challenge starts, the
 * invite waits (see `PendingInviteWatcher`) and opens again when it can.
 */
export function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = parseInviteInput(params.code ?? '');
  const session = useAuthStore((state) => state.session);
  const signedIn = session !== null;
  const user = useUser({ enabled: signedIn });
  const profile = user.data ?? session?.initialUser ?? null;
  const gate = inviteGate({ signedIn, onboarded: profile !== null && !needsOnboarding(profile) });

  // Kept while the user cannot see the team yet; once they can, it has arrived.
  useEffect(() => {
    if (!code) return;
    const store = usePendingInviteStore.getState();
    if (gate === 'preview') store.clear();
    else store.hold(code);
  }, [code, gate]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen background="warm" testID="invite-screen">
      <IconButton
        icon={X}
        accessibilityLabel="Close"
        onPress={close}
        style={styles.close}
        testID="invite-close"
      />
      {!code ? (
        <Outcome
          title={TEAM_PROBLEMS.invalid.title}
          message="This invite link is incomplete. Ask your friend to share it again, or enter the code on the Friends tab."
          action={{ label: 'Close', onPress: close }}
        />
      ) : gate === 'signIn' ? (
        <Outcome
          title="You’re invited to a Milo team"
          message="Sign in or create an account to see the team and join it. Your invite will wait."
          action={{ label: 'Sign in', onPress: () => router.replace('/sign-in') }}
          secondary={{ label: 'Create account', onPress: () => router.replace('/sign-up') }}
        />
      ) : gate === 'onboarding' ? (
        <Outcome
          title="Start your challenge first"
          message="Teams climb the 90 days together. Set up your challenge — your invite will be waiting."
          action={{ label: 'Continue', onPress: () => router.replace('/onboarding') }}
        />
      ) : (
        <InvitePreviewView code={code} onClose={close} />
      )}
    </Screen>
  );
}

function InvitePreviewView({ code, onClose }: { code: InviteCode; onClose: () => void }) {
  const router = useRouter();
  const repositories = useRepositories();
  const preview = useInvitePreview(code);
  const join = useJoinTeam();
  const openTeam = () => router.replace(FRIENDS);

  if (!repositories.friends.serverBacked) {
    const { title, message } = TEAM_PROBLEMS.unavailable;
    return (
      <Outcome title={title} message={message} action={{ label: 'Close', onPress: onClose }} />
    );
  }
  if (preview.isPending) return <LoadingState label="Checking the invite" />;
  if (preview.isError) {
    const problem = teamProblemOf(preview.error);
    const { title, message } = TEAM_PROBLEMS[problem];
    return problem === 'offline' || problem === 'unknown' || problem === 'tooManyTries' ? (
      <Outcome
        title={title}
        message={message}
        action={{ label: 'Try again', onPress: () => void preview.refetch() }}
        secondary={{ label: 'Close', onPress: onClose }}
      />
    ) : (
      <Outcome title={title} message={message} action={{ label: 'Close', onPress: onClose }} />
    );
  }

  const invite = preview.data;
  const copy = previewCopy(invite);
  if (invite.status === 'full') {
    return (
      <Outcome
        title={TEAM_PROBLEMS.full.title}
        message={copy.line}
        action={{ label: 'Close', onPress: onClose }}
      />
    );
  }
  if (invite.status !== 'canJoin') {
    return (
      <Outcome
        title={
          invite.status === 'alreadyMember'
            ? TEAM_PROBLEMS.alreadyMember.title
            : TEAM_PROBLEMS.inAnotherTeam.title
        }
        message={copy.line}
        action={{ label: 'Open my team', onPress: openTeam }}
        secondary={{ label: 'Close', onPress: onClose }}
      />
    );
  }

  const confirm = () =>
    join.mutate(code, {
      onSuccess: () => {
        triggerHaptic('submit');
        openTeam();
      },
    });
  return (
    <View style={styles.body}>
      <View style={styles.card} testID="invite-preview">
        <View style={styles.icon}>
          <Users size={22} color={colors.text.brand} strokeWidth={2.2} />
        </View>
        <AppText variant="overline" color="wood">
          Team invite
        </AppText>
        <AppText variant="title1" accessibilityRole="header">
          {copy.title}
        </AppText>
        <AppText variant="bodyStrong" color="secondary">
          {`${invite.memberCount}/${invite.capacity} members`}
        </AppText>
        <AppText variant="body" color="secondary">
          Climb the same 90 days together: a team streak grows on the days everyone finishes.
        </AppText>
      </View>
      {join.isError ? <TeamNotice problem={teamProblemOf(join.error)} /> : null}
      <View style={styles.actions}>
        <Button
          label="Join team"
          onPress={confirm}
          loading={join.isPending}
          fullWidth
          testID="invite-join"
        />
        <Button label="Not now" variant="ghost" onPress={onClose} fullWidth haptic={null} />
      </View>
    </View>
  );
}

/** Where the invite ends for now: what happened, and the way on. */
function Outcome({
  title,
  message,
  action,
  secondary,
}: {
  title: string;
  message: string;
  action: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.outcome} testID="invite-outcome">
      <AssetImage asset={emptyStates.noFriendsYet} width={200} />
      <View style={styles.outcomeText}>
        <AppText variant="title2" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {message}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label={action.label} onPress={action.onPress} fullWidth />
        {secondary ? (
          <Button label={secondary.label} variant="ghost" onPress={secondary.onPress} fullWidth />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { marginLeft: -spacing[3], marginTop: spacing[2] },
  body: { flex: 1, justifyContent: 'center', gap: spacing[5], paddingBottom: spacing[8] },
  card: {
    gap: spacing[2],
    padding: spacing[6],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  actions: { gap: spacing[2], alignSelf: 'stretch' },
  outcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingBottom: spacing[8],
  },
  outcomeText: { gap: spacing[2], alignItems: 'center', maxWidth: 320 },
});
