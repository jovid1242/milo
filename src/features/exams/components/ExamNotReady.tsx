import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { spacing } from '@/theme';

export type ExamNotReadyProps = {
  title: string;
  message: string;
  onClose: () => void;
};

/** An exam that cannot be taken right now — honest, calm, one way back. */
export function ExamNotReady({ title, message, onClose }: ExamNotReadyProps) {
  return (
    <QuestStage centered footer={<Button label="Back to journey" onPress={onClose} fullWidth />}>
      <View style={styles.body} testID="exam-not-ready">
        <AssetImage asset={mascots.thinking} width={170} />
        <View style={styles.text}>
          <AppText variant="title2" align="center" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body" color="secondary" align="center">
            {message}
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
