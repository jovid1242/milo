import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, LoadingState, Screen } from '@/components/ui';
import { useChapters } from '@/features/challenge/queries';
import { useProgressState } from '@/features/progress/queries';
import type { Chapter, ProgressState } from '@/schemas';
import { spacing } from '@/theme';

import { ChapterCard, type ChapterStatus } from './components/ChapterCard';

function statusFor(chapter: Chapter, state: ProgressState): ChapterStatus {
  if (state.currentDay < chapter.startDay) return 'locked';
  if (state.currentDay > chapter.endDay) return 'completed';
  return 'current';
}

export function JourneyScreen() {
  const chapters = useChapters();
  const progress = useProgressState();
  const [cardWidth, setCardWidth] = useState(0);

  if (chapters.isPending || progress.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading the journey" />
      </Screen>
    );
  }

  if (chapters.isError || progress.isError) {
    return (
      <Screen>
        <ErrorState
          error={chapters.error ?? progress.error}
          onRetry={() => {
            void chapters.refetch();
            void progress.refetch();
          }}
        />
      </Screen>
    );
  }

  const state = progress.data;
  const completedDays = new Set(state.completedDays);

  return (
    <Screen scroll>
      <View
        style={styles.content}
        onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <AppText variant="overline" color="wood">
            The journey
          </AppText>
          <AppText variant="title1">90 days to the summit</AppText>
        </View>

        {cardWidth > 0
          ? chapters.data.map((chapter) => (
              <View key={chapter.id} style={styles.chapter}>
                <ChapterCard
                  chapter={chapter}
                  status={statusFor(chapter, state)}
                  currentDay={state.currentDay}
                  completedDays={
                    [...completedDays].filter(
                      (day) => day >= chapter.startDay && day <= chapter.endDay,
                    ).length
                  }
                  width={cardWidth}
                />
                <View style={styles.caption}>
                  <AppText variant="title3">{chapter.title}</AppText>
                  <AppText variant="caption" color="secondary">
                    {`Days ${chapter.startDay}–${chapter.endDay} · ${chapter.tagline}`}
                  </AppText>
                </View>
              </View>
            ))
          : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[4] },
  header: { gap: spacing[1] },
  chapter: { gap: spacing[3] },
  caption: { gap: spacing[1], paddingHorizontal: spacing[1] },
});
