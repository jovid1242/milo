import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  /** The safe choice — the primary button. */
  stayLabel: string;
  /** The choice that leaves — quieter on purpose. */
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
};

/** "Are you sure?" without a system alert. Tapping outside means "stay". */
export function ConfirmSheet({
  visible,
  title,
  message,
  stayLabel,
  leaveLabel,
  onStay,
  onLeave,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onStay} closeLabel={stayLabel}>
      <View style={styles.text}>
        <AppText variant="title2" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="secondary">
          {message}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label={stayLabel} onPress={onStay} fullWidth size="md" />
        <Button label={leaveLabel} onPress={onLeave} fullWidth size="md" variant="ghost" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing[2] },
  actions: { gap: spacing[2] },
});
