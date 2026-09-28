import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { BellRing, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { AppText, Divider } from '@/components/ui';
import { SettingToggleRow } from '@/features/settings/components/SettingToggleRow';
import { SettingValueRow } from '@/features/settings/components/SettingValueRow';
import { spacing } from '@/theme';

import { formatReminderTime, fromPickerDate, toPickerDate } from '../format';
import { useReminderSettings } from '../use-reminder-settings';
import { ReminderPermissionSheet } from './ReminderPermissionSheet';
import { ReminderTimeSheet } from './ReminderTimeSheet';

/**
 * Settings → Reminders: one switch, and the time once it is on. A permission
 * problem appears only when there is one, and only as long as it matters.
 */
export function ReminderSettings() {
  const reminder = useReminderSettings();
  const [picking, setPicking] = useState(false);
  // A fresh wheel each time it opens, starting from the saved time.
  const [pickerKey, setPickerKey] = useState(0);

  const pickTime = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toPickerDate(reminder.time),
        mode: 'time',
        // Called only for "OK"; cancelling the dialog changes nothing.
        onValueChange: (_event, date) => reminder.setTime(fromPickerDate(date)),
      });
      return;
    }
    setPickerKey((key) => key + 1);
    setPicking(true);
  };

  return (
    <>
      <SettingToggleRow
        icon={BellRing}
        label="Daily reminder"
        description="One gentle nudge a day"
        value={reminder.enabled}
        onValueChange={reminder.toggle}
        disabled={reminder.busy}
      />
      {reminder.enabled ? (
        <>
          <Divider inset={48} />
          <SettingValueRow
            icon={Clock}
            label="Reminder time"
            value={formatReminderTime(reminder.time)}
            onPress={pickTime}
            accessibilityHint="Opens a time picker"
          />
        </>
      ) : null}
      {reminder.failed ? (
        <AppText
          variant="caption"
          color="danger"
          style={styles.note}
          accessibilityLiveRegion="polite">
          Milo couldn’t set up every reminder. It will try again the next time the app opens.
        </AppText>
      ) : null}

      <ReminderPermissionSheet
        prompt={reminder.prompt}
        onAllow={reminder.allow}
        onOpenSettings={reminder.openSystemSettings}
        onDismiss={reminder.dismiss}
      />
      {Platform.OS === 'ios' ? (
        <ReminderTimeSheet
          key={pickerKey}
          visible={picking}
          time={reminder.time}
          onSave={(time) => {
            reminder.setTime(time);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: { paddingBottom: spacing[3] },
});
