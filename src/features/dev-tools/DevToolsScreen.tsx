import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Divider, IconButton, Screen } from '@/components/ui';
import { missingAssets } from '@/constants/assets';
import { useRepositories } from '@/data/repository-provider';
import { useAchievements } from '@/features/achievements/queries';
import { playQuestOutcomeFeedback } from '@/features/progress/feedback';
import { useProgressState } from '@/features/progress/queries';
import type { QuestOutcome } from '@/features/progress/use-cases';
import { logger } from '@/lib/logger';
import { FEEDBACK_EVENTS, playFeedback } from '@/services/feedback';
import { HAPTIC_PATTERNS, triggerHaptic } from '@/services/haptics/haptics';
import { useDevStore } from '@/stores/dev-store';
import { colors, spacing } from '@/theme';

import * as dev from './dev-actions';

const DAY_SHORTCUTS = [1, 7, 10, 11, 30, 31, 60, 61, 89, 90];
const STREAKS = [0, 3, 7, 14, 30];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" color="wood">
        {title}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/** Never reachable in production: the route redirects when `__DEV__` is false. */
export function DevToolsScreen() {
  const router = useRouter();
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const progress = useProgressState();
  const achievements = useAchievements();
  const simulateOffline = useDevStore((state) => state.simulateOffline);
  const setSimulateOffline = useDevStore((state) => state.setSimulateOffline);
  const [busy, setBusy] = useState(false);

  const context: dev.DevContext = { repositories, queryClient };

  const run = (action: () => Promise<QuestOutcome | null | void>) => () => {
    if (busy) return;
    setBusy(true);
    action()
      .then((outcome) => {
        if (outcome) playQuestOutcomeFeedback(outcome);
      })
      .catch((error: unknown) => {
        logger.error('dev action failed', error);
        Alert.alert('Dev action failed', error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy(false));
  };

  const chip = (label: string, action: () => Promise<QuestOutcome | null | void>) => (
    <Button
      key={label}
      label={label}
      size="sm"
      variant="secondary"
      haptic={null}
      disabled={busy}
      onPress={run(action)}
    />
  );

  const state = progress.data;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          {/* Left-aligned: in Expo Go the floating dev-menu bubble covers the top-right corner. */}
          <IconButton
            icon={X}
            accessibilityLabel="Close developer tools"
            onPress={() => router.back()}
            style={styles.close}
          />
          <View style={styles.headerText}>
            <AppText variant="title1">Developer tools</AppText>
            <AppText variant="caption" color="secondary">
              {state
                ? `Day ${state.currentDay} · streak ${state.streak} · ${state.totalXp} XP · level ${state.level.level} · ${state.todayCompletedQuestIds.length} quests today · ${state.unlockedAchievementIds.length} badges`
                : 'Loading state…'}
            </AppText>
          </View>
        </View>

        <Section title="Current day">
          {chip('−1 day', () => dev.shiftCurrentDay(context, -1))}
          {chip('+1 day', () => dev.shiftCurrentDay(context, 1))}
          {DAY_SHORTCUTS.map((day) => chip(`Day ${day}`, () => dev.setCurrentDay(context, day)))}
        </Section>

        <Section title="Quests">
          {chip('Complete next quest', () => dev.completeNextQuest(context))}
          {chip('Complete today', () => dev.completeToday(context))}
          {chip('Perfect quiz', () => dev.completeNextQuest(context, { perfect: true }))}
          {chip('Reset today', () => dev.resetToday(context))}
        </Section>

        <Section title="Streak">
          {STREAKS.map((streak) => chip(`${streak} days`, () => dev.setStreak(context, streak)))}
        </Section>

        <Section title="XP">
          {chip('+50 XP', () => dev.addXp(context, 50))}
          {chip('+250 XP', () => dev.addXp(context, 250))}
          {chip('+1000 XP', () => dev.addXp(context, 1000))}
        </Section>

        <Section title="Simulate">
          {chip('Weekly exam pass', () => dev.simulateWeeklyExam(context))}
          {chip('Day 90 summit', () => dev.simulateSummit(context))}
        </Section>

        <Section title="Achievements">
          {(achievements.data ?? []).map((item) =>
            chip(`${item.unlockedAt ? '✓ ' : ''}${item.achievement.title}`, () =>
              dev.setAchievementUnlocked(context, item.achievement.id, item.unlockedAt === null),
            ),
          )}
          {chip('Reset achievements', () => dev.resetAchievements(context))}
        </Section>

        <Section title="Friends & network">
          {chip('Clear friends', () => dev.clearFriends(context))}
          {chip('Restore friends', () => dev.restoreFriends(context))}
        </Section>
        <View style={styles.toggleRow}>
          <AppText variant="bodyMedium">Simulate offline</AppText>
          <Switch
            value={simulateOffline}
            onValueChange={setSimulateOffline}
            accessibilityLabel="Simulate offline"
            trackColor={{ false: colors.border.default, true: colors.brand.primary }}
            thumbColor={colors.surface.base}
          />
        </View>

        <Section title="Feedback events (sound + haptics)">
          {FEEDBACK_EVENTS.map((event) => (
            <Button
              key={event}
              label={event}
              size="sm"
              variant="ghost"
              haptic={null}
              onPress={() => playFeedback(event)}
            />
          ))}
        </Section>

        <Section title="Haptic patterns">
          {HAPTIC_PATTERNS.map((pattern) => (
            <Button
              key={pattern}
              label={pattern}
              size="sm"
              variant="ghost"
              haptic={null}
              onPress={() => triggerHaptic(pattern)}
            />
          ))}
        </Section>

        {missingAssets.length > 0 ? (
          <Section title="Missing assets">
            <AppText variant="caption" color="danger">
              {missingAssets.map((asset) => asset.expected).join('\n')}
            </AppText>
          </Section>
        ) : null}

        <Divider />

        <Section title="Danger zone">
          {chip('Reset progress', () => dev.resetProgress(context))}
          <Button
            label="Reset all local data"
            size="sm"
            variant="danger"
            haptic={null}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                'Reset all local data?',
                'Deletes the database: profile, progress, achievements and friends.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: run(() => dev.resetAllLocalData(context)),
                  },
                ],
              )
            }
          />
        </Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Extra bottom room: the last controls must not sit on the sheet's edge.
  content: { gap: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[20] },
  header: { gap: spacing[2] },
  close: { marginLeft: -spacing[3] },
  headerText: { gap: spacing[1] },
  section: { gap: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
