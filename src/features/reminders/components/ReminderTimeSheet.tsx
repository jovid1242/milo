import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import type { ReminderTime } from '@/schemas';
import { colors, spacing } from '@/theme';

import { fromPickerDate, toPickerDate } from '../format';

export type ReminderTimeSheetProps = {
  visible: boolean;
  time: ReminderTime;
  onSave: (time: ReminderTime) => void;
  onClose: () => void;
};

/**
 * iOS: the system time wheel in a sheet, saved only on "Save" — spinning it
 * past a few times changes nothing until then. (Android opens its own clock
 * dialog instead; see `ReminderSettings`.)
 */
export function ReminderTimeSheet({ visible, time, onSave, onClose }: ReminderTimeSheetProps) {
  const [draft, setDraft] = useState(() => toPickerDate(time));

  return (
    // Taller than most sheets (the wheel alone is 216pt): it slides its whole
    // height, so its top never lingers on screen as it opens and closes.
    <Sheet visible={visible} onClose={onClose} closeLabel="Cancel" slideFullHeight>
      <AppText variant="title2" accessibilityRole="header">
        Reminder time
      </AppText>
      <View style={styles.picker}>
        <DateTimePicker
          value={draft}
          mode="time"
          display="spinner"
          themeVariant="light"
          textColor={colors.text.primary}
          onValueChange={(_event, date) => setDraft(date)}
          testID="reminder-time-picker"
        />
      </View>
      <View style={styles.actions}>
        <Button
          label="Save"
          onPress={() => onSave(fromPickerDate(draft))}
          fullWidth
          size="md"
          testID="reminder-time-save"
        />
        <Button label="Cancel" onPress={onClose} fullWidth size="md" variant="ghost" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  picker: { alignItems: 'center' },
  actions: { gap: spacing[2] },
});
