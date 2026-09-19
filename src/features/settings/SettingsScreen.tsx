import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronLeft, Sparkles, Vibrate, Volume2, Wrench } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  ConfirmSheet,
  Divider,
  IconButton,
  LoadingState,
  Screen,
} from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { useRepositories } from '@/data/repository-provider';
import { resetProgress } from '@/features/dev-tools/dev-actions';
import { LinkRow } from '@/features/profile/components/LinkRow';
import { useUser } from '@/features/profile/queries';
import { useProgressState } from '@/features/progress/queries';
import { useSystemReduceMotion } from '@/hooks/use-system-reduce-motion';
import { parseLocalDate } from '@/lib/dates';
import { logger } from '@/lib/logger';
import { playFeedback } from '@/services/feedback';
import { triggerHaptic } from '@/services/haptics/haptics';
import { useSettingsStore } from '@/stores/settings-store';
import { colors, radius, spacing } from '@/theme';

import { DisplayNameForm } from './components/DisplayNameForm';
import { SettingToggleRow } from './components/SettingToggleRow';
import { visibleSettingsSections, type SettingsSection } from './logic/sections';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="overline" color="wood" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="body" color="secondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

/** Settings that really work — no placeholders, no fake toggles. */
export function SettingsScreen() {
  const router = useRouter();
  const user = useUser();
  const progress = useProgressState();
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const reduceMotion = useSystemReduceMotion();
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setSoundEnabled = useSettingsStore((state) => state.setSoundEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const version = Constants.expoConfig?.version;

  const sections: Record<SettingsSection, ReactNode> = {
    feedback: (
      <Group title="Sound & haptics" key="feedback">
        <SettingToggleRow
          icon={Volume2}
          label="Sound effects"
          description="Answers, quests and rewards"
          value={soundEnabled}
          onValueChange={(next) => {
            setSoundEnabled(next);
            // One soft confirmation when sound comes back; silence when it goes.
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
      </Group>
    ),
    motion: (
      <Group title="Motion" key="motion">
        <View style={styles.motionRow}>
          <View style={styles.motionIcon}>
            <Sparkles size={18} color={colors.text.brand} strokeWidth={2} />
          </View>
          <View style={styles.motionText}>
            <AppText variant="bodyStrong">
              {reduceMotion === null
                ? 'Reduce Motion'
                : `Reduce Motion is ${reduceMotion ? 'on' : 'off'}`}
            </AppText>
            <AppText variant="caption" color="secondary">
              Animations follow your iPhone setting in Accessibility → Motion.
            </AppText>
          </View>
        </View>
      </Group>
    ),
    profile: (
      <Group title="Profile" key="profile">
        {user.isPending ? (
          <LoadingState fullScreen={false} />
        ) : user.isSuccess ? (
          <DisplayNameForm initialName={user.data.displayName} />
        ) : (
          <AppText variant="body" color="danger">
            Could not load your profile.
          </AppText>
        )}
      </Group>
    ),
    challenge: (
      <Group title="Challenge" key="challenge">
        {user.data ? (
          <InfoRow
            label="Started"
            value={parseLocalDate(user.data.challengeStartDate).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
        ) : null}
        <Divider />
        {progress.data ? (
          <InfoRow
            label="Current day"
            value={`${progress.data.currentDay} of ${CHALLENGE.totalDays}`}
          />
        ) : null}
      </Group>
    ),
    developer: (
      <Group title="Developer" key="developer">
        <LinkRow
          icon={Wrench}
          label="Developer tools"
          hint="Simulate progress, sounds and haptics"
          onPress={() => router.push('/dev-tools')}
        />
        <Divider />
        <Button
          label="Reset local challenge"
          variant="danger"
          size="sm"
          haptic={null}
          onPress={() => setConfirmingReset(true)}
          style={styles.reset}
        />
      </Group>
    ),
    about: (
      <Group title="About" key="about">
        <View style={styles.about}>
          <AppText variant="bodyStrong">Milo</AppText>
          <AppText variant="body" color="secondary">
            90 Day English Challenge
          </AppText>
          {version ? (
            <AppText variant="caption" color="tertiary">
              {`Version ${version}`}
            </AppText>
          ) : null}
        </View>
      </Group>
    ),
  };

  return (
    <Screen scroll background="warm" edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.back}
          />
          <AppText variant="title1" accessibilityRole="header">
            Settings
          </AppText>
        </View>
        {visibleSettingsSections(__DEV__).map((section) => sections[section])}
      </View>
      {__DEV__ ? (
        <ConfirmSheet
          visible={confirmingReset}
          title="Reset local challenge?"
          message="This will erase local progress: days, XP, words and badges. Your name and team stay."
          stayLabel="Cancel"
          leaveLabel="Reset"
          onStay={() => setConfirmingReset(false)}
          onLeave={() => {
            setConfirmingReset(false);
            resetProgress({ repositories, queryClient }).catch((error: unknown) =>
              logger.error('could not reset the local challenge', error),
            );
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[2], paddingBottom: spacing[8] },
  header: { gap: spacing[2] },
  back: { marginLeft: -spacing[3] },
  group: { gap: spacing[2] },
  card: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  motionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  motionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motionText: { flex: 1, gap: spacing[1] },
  reset: { alignSelf: 'flex-start', marginVertical: spacing[3] },
  about: { gap: 2, paddingVertical: spacing[3] },
});
