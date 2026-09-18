import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { durations, spacing } from '@/theme';

import type { HomeMoment } from '../hooks/use-journey-moments';
import type { JourneyStep, TodayJourney } from '../logic/today-journey';
import { CampPoint } from './CampPoint';
import { JourneyStepRow } from './JourneyStepRow';
import { QuestPips } from './QuestPips';

export type TodayJourneySectionProps = {
  journey: TodayJourney;
  moment: HomeMoment | null;
  campArtWidth: number;
  onOpenQuest: (step: JourneyStep) => void;
};

const FIRST_STEP_DELAY = 200;
const STEP_STAGGER = 55;

/** Today's quests as one route: waypoint after waypoint, ending at camp. */
export function TodayJourneySection({
  journey,
  moment,
  campArtWidth,
  onOpenQuest,
}: TodayJourneySectionProps) {
  const total = journey.steps.length;
  const done = journey.completedCount;

  return (
    <View style={styles.section}>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(140)} style={styles.header}>
        <AppText variant="title3" accessibilityRole="header">
          Today&apos;s journey
        </AppText>
        <View
          accessible
          accessibilityLabel={`${done} of ${total} quests done`}
          style={styles.progress}>
          <QuestPips total={total} done={done} />
          <AppText variant="label" color="secondary">
            {`${done} of ${total}`}
          </AppText>
        </View>
      </Animated.View>

      <View>
        {journey.steps.map((step, index) => (
          <JourneyStepRow
            key={step.quest.id}
            step={step}
            index={index}
            total={total}
            celebrateKey={
              moment?.newlyCompletedQuestIds.includes(step.quest.id) ? moment.id : null
            }
            entranceDelay={FIRST_STEP_DELAY + index * STEP_STAGGER}
            onOpen={onOpenQuest}
          />
        ))}
        <CampPoint
          journey={journey}
          artWidth={campArtWidth}
          celebrateKey={moment?.dayCompleted ? moment.id : null}
          entranceDelay={FIRST_STEP_DELAY + total * STEP_STAGGER}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
