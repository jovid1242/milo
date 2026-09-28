import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import { spacing } from '@/theme';

import type { ReminderPrompt } from '../use-reminder-settings';

type Content = {
  title: string;
  message: string;
  primary: { label: string; action: 'allow' | 'openSettings' | 'dismiss' };
  /** The quiet way out, when there is a real choice. */
  secondary?: string;
};

const CONTENT: Record<ReminderPrompt, Content> = {
  explain: {
    title: 'A daily nudge from Milo',
    message:
      'One short reminder a day, at the time you choose — nothing else. Your phone will ask you to allow notifications.',
    primary: { label: 'Allow reminders', action: 'allow' },
    secondary: 'Not now',
  },
  denied: {
    title: 'Reminders stay off',
    message:
      'Without notifications Milo can’t remind you. You can switch the reminder on again any time.',
    primary: { label: 'OK', action: 'dismiss' },
  },
  blocked: {
    title: 'Notifications are turned off',
    message:
      'Notifications for Milo are off in your phone’s Settings. Turn them on there, then switch the reminder on again.',
    primary: { label: 'Open Settings', action: 'openSettings' },
    secondary: 'Not now',
  },
  unavailable: {
    title: 'Reminders aren’t available',
    message: 'This device can’t schedule notifications right now.',
    primary: { label: 'OK', action: 'dismiss' },
  },
};

export type ReminderPermissionSheetProps = {
  prompt: ReminderPrompt | null;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

/**
 * The words around the system permission dialog: a calm explanation before
 * it, and after a refusal the way forward — never a bare system popup, never
 * a guilt trip.
 */
export function ReminderPermissionSheet({
  prompt,
  onAllow,
  onOpenSettings,
  onDismiss,
}: ReminderPermissionSheetProps) {
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
          testID="reminder-permission-primary"
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
