import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, Divider, LoadingState, ProgressBar, Screen } from '@/components/ui';
import { useChapters, useDailyChallenge } from '@/features/challenge/queries';
import { useProgressState } from '@/features/progress/queries';
import { findChapterForDay } from '@/features/challenge/logic/calendar';
import { spacing } from '@/theme';

import { DayHeader } from './components/DayHeader';
import { QuestRow } from './components/QuestRow';

export function TodayScreen() {
  const progress = useProgressState();
  const chapters = useChapters();
  const daily = useDailyChallenge(progress.data?.currentDay);

  if (progress.isPending || chapters.isPending || daily.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading your day" />
      </Screen>
    );
  }

  if (progress.isError || chapters.isError || daily.isError) {
    return (
      <Screen>
        <ErrorState
          error={progress.error ?? chapters.error ?? daily.error}
          onRetry={() => {
            void progress.refetch();
            void chapters.refetch();
            void daily.refetch();
          }}
        />
      </Screen>
    );
  }

  const state = progress.data;
  const chapter = findChapterForDay(chapters.data, state.currentDay);
  const completed = new Set(state.todayCompletedQuestIds);
  const doneCount = daily.data.quests.filter((quest) => completed.has(quest.id)).length;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <DayHeader chapter={chapter} progress={state} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="title3">Today&apos;s quests</AppText>
            <AppText variant="label" color="secondary">
              {`${doneCount} of ${daily.data.quests.length}`}
            </AppText>
          </View>
          <ProgressBar
            progress={daily.data.quests.length === 0 ? 0 : doneCount / daily.data.quests.length}
            accessibilityLabel="Today's quests progress"
          />
        </View>

        <View>
          {daily.data.quests.map((quest, index) => (
            <Fragment key={quest.id}>
              {index > 0 ? <Divider inset={60} /> : null}
              <QuestRow quest={quest} completed={completed.has(quest.id)} />
            </Fragment>
          ))}
        </View>

        {state.isTodayComplete ? (
          <AppText variant="bodyMedium" color="brand" align="center">
            Day {state.currentDay} complete. See you tomorrow.
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[8], paddingTop: spacing[4] },
  section: { gap: spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
