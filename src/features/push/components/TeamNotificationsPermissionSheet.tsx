import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import { spacing } from '@/theme';

import type { TeamNotificationPrompt } from '../use-team-notification-settings';

type Content = {
  title: string;
  message: string;
  primary: { label: string; action: 'allow' | 'openSettings' | 'dismiss' };
  /** The quiet way out, when there is a real choice. */
  secondary?: string;
};

const CONTENT: Record<TeamNotificationPrompt, Content> = {
  explain: {
    title: 'News from your team',
    message:
      'When a teammate joins or finishes their day, and when the team streak grows — nothing else. Your phone will ask you to allow notifications.',
    primary: { label: 'Allow notifications', action: 'allow' },
    secondary: 'Not now',
  },
  denied: {
    title: 'Team notifications stay off',
    message:
      'Without notifications Milo can’t tell you what your team is up to. You can switch them on again any time.',
    primary: { label: 'OK', action: 'dismiss' },
  },
  blocked: {
    title: 'Notifications are turned off',
    message:
      'Notifications for Milo are off in your phone’s Settings. Turn them on there, then switch team notifications on again.',
    primary: { label: 'Open Settings', action: 'openSettings' },
    secondary: 'Not now',
  },
  unavailable: {
    title: 'Team notifications aren’t available',
    message: 'This device can’t receive notifications from Milo right now.',
    primary: { label: 'OK', action: 'dismiss' },
  },
};

export type TeamNotificationsPermissionSheetProps = {
  prompt: TeamNotificationPrompt | null;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

/**
 * The words around the system permission dialog, as the daily reminder has
 * them: a calm explanation before it, and after a refusal the way forward.
 */
export function TeamNotificationsPermissionSheet({
  prompt,
  onAllow,
  onOpenSettings,
  onDismiss,
}: TeamNotificationsPermissionSheetProps) {
  // The sheet keeps its last content while it slides away.
  const content = CONTENT[prompt ?? 'explain'];
  const actions = { allow: onAllow, openSettings: onOpenSettings, dismiss: onDismiss };

  return (
    <Sheet visible={prompt !== null} onClose={onDismiss} closeLabel={content.secondary ?? 'Close'}>
      <View style={styles.text}>
        <AppText variant="title2" accessibilityRole="header">
          {content.title}
        </AppText>
        <AppText variant="body" color="secondary">
          {content.message}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label={content.primary.label}
          onPress={actions[content.primary.action]}
          fullWidth
          size="md"
          testID="team-notifications-permission-primary"
        />
        {content.secondary ? (
          <Button
            label={content.secondary}
            onPress={onDismiss}
            fullWidth
            size="md"
            variant="ghost"
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing[2] },
  actions: { gap: spacing[2] },
});
