import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronLeft, Vibrate, Volume2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Divider, IconButton, LoadingState, Screen } from '@/components/ui';
import { useUser } from '@/features/profile/queries';
import { playFeedback } from '@/services/feedback';
import { triggerHaptic } from '@/services/haptics/haptics';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

import { DisplayNameForm } from './components/DisplayNameForm';
import { SettingToggleRow } from './components/SettingToggleRow';

export function SettingsScreen() {
  const router = useRouter();
  const user = useUser();
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setSoundEnabled = useSettingsStore((state) => state.setSoundEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.back}
          />
          <AppText variant="title1">Settings</AppText>
        </View>

        <View style={styles.section}>
          <AppText variant="overline" color="wood">
            Feedback
          </AppText>
          <SettingToggleRow
            icon={Volume2}
            label="Sound effects"
            description="Answers, quests and rewards"
            value={soundEnabled}
            onValueChange={(next) => {
              setSoundEnabled(next);
              if (next) playFeedback('importantAction');
            }}
          />
          <Divider inset={48} />
          <SettingToggleRow
            icon={Vibrate}
            label="Haptics"
            description="Subtle vibration feedback"
            value={hapticsEnabled}
            onValueChange={(next) => {
              setHapticsEnabled(next);
              if (next) triggerHaptic('press');
            }}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="overline" color="wood">
            Profile
          </AppText>
          {user.isPending ? (
            <LoadingState fullScreen={false} />
          ) : user.isSuccess ? (
            <DisplayNameForm initialName={user.data.displayName} />
          ) : (
            <AppText variant="body" color="danger">
              Could not load your profile.
            </AppText>
          )}
        </View>

        <View style={styles.section}>
          <AppText variant="overline" color="wood">
            About
          </AppText>
          <AppText variant="body" color="secondary">
            {`Milo · version ${Constants.expoConfig?.version ?? '1.0.0'}`}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[8], paddingTop: spacing[2] },
  header: { gap: spacing[2] },
  back: { marginLeft: -spacing[3] },
  section: { gap: spacing[3] },
});
