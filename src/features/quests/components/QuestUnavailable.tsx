import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { spacing } from '@/theme';

import { QuestStage } from './QuestStage';

/** A quest whose content is not written yet: honest, calm, one way back. */
export function QuestUnavailable({ day, onClose }: { day: number; onClose: () => void }) {
  return (
    <QuestStage centered footer={<Button label="Back to journey" onPress={onClose} fullWidth />}>
      <View style={styles.body}>
        <AssetImage asset={mascots.thinking} width={170} />
        <View style={styles.text}>
          <AppText variant="title2" align="center" accessibilityRole="header">
            {`Day ${day}'s words are on their way`}
          </AppText>
          <AppText variant="body" color="secondary" align="center">
            This quest is not ready yet. Please check back soon.
          </AppText>
        </View>
      </View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing[5] },
  text: { gap: spacing[2], maxWidth: 320 },
});
