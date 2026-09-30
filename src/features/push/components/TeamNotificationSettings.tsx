import { Users } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import { SettingToggleRow } from '@/features/settings/components/SettingToggleRow';
import { spacing } from '@/theme';

import { useTeamNotificationSettings } from '../use-team-notification-settings';
import { TeamNotificationsPermissionSheet } from './TeamNotificationsPermissionSheet';

const NOTES = {
  offline: 'Internet connection required. Try again when you’re online.',
  failed: 'Milo couldn’t turn on team notifications. Try again in a moment.',
} as const;

/**
 * Settings → Team: one switch for the team's news on this phone, for the
 * account signed in. The daily reminder has its own switch — either works
 * without the other.
 */
export function TeamNotificationSettings({ owner }: { owner: string }) {
  const team = useTeamNotificationSettings(owner);

  return (
    <>
      <SettingToggleRow
        icon={Users}
        label="Team notifications"
        description="Teammates joining and finishing their day"
        value={team.enabled}
        onValueChange={team.toggle}
        disabled={team.busy}
      />
      {team.note ? (
        <AppText
          variant="caption"
          color="danger"
          style={styles.note}
          accessibilityLiveRegion="polite">
          {NOTES[team.note]}
        </AppText>
      ) : null}
      <TeamNotificationsPermissionSheet
        prompt={team.prompt}
        onAllow={team.allow}
        onOpenSettings={team.openSystemSettings}
        onDismiss={team.dismiss}
      />
    </>
  );
}

const styles = StyleSheet.create({
  note: { paddingBottom: spacing[3] },
});
