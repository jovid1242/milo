import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';

import { AppText, Badge, Button, ProgressBar } from '@/components/ui';
import type { QuestType } from '@/schemas';
import { colors, durations, radius, shadows, spacing } from '@/theme';

import type { JourneyStep } from '../logic/today-journey';
import { CURRENT_NODE_SIZE, NODE_SIZE, QuestNode } from './QuestNode';
import { TrailConnector } from './TrailConnector';

export const RAIL_WIDTH = CURRENT_NODE_SIZE;

export type JourneyStepRowProps = {
  step: JourneyStep;
  index: number;
  total: number;
  /** Set when this quest was just completed. */
  celebrateKey: number | null;
  entranceDelay: number;
  onOpen: (step: JourneyStep) => void;
};

const START_LABELS: Record<QuestType, string> = {
  vocabulary: 'Learn new words',
  grammar: 'Start grammar',
  reading: 'Start reading',
  review: 'Start review',
  weeklyExam: 'Start the exam',
  finalBattle: 'Begin the last climb',
};

/** A waypoint on the rail, its trail below, and what to do there. */
export function JourneyStepRow({
  step,
  index,
  total,
  celebrateKey,
  entranceDelay,
  onOpen,
}: JourneyStepRowProps) {
  const isCurrent = step.status === 'available' || step.status === 'inProgress';

  return (
    <Animated.View
      entering={FadeInDown.duration(durations.normal + 70).delay(entranceDelay)}
      layout={LinearTransition.duration(durations.normal)}
      style={styles.row}>
      <View style={styles.rail}>
        <QuestNode step={step} celebrateKey={celebrateKey} />
        <TrailConnector walked={step.status === 'completed'} revealKey={celebrateKey} />
      </View>

      {/* Skips the fade on first render; afterwards a status change fades the new content in. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View
          key={isCurrent ? 'current' : 'summary'}
          entering={FadeIn.duration(durations.normal).delay(isCurrent ? 180 : 0)}
          style={styles.body}>
          {isCurrent ? (
            <CurrentQuestCard step={step} index={index} total={total} onOpen={onOpen} />
          ) : (
            <StepSummary step={step} />
          )}
        </Animated.View>
      </LayoutAnimationConfig>
    </Animated.View>
  );
}

function CurrentQuestCard({
  step,
  index,
  total,
  onOpen,
}: {
  step: JourneyStep;
  index: number;
  total: number;
  onOpen: (step: JourneyStep) => void;
}) {
  const { quest } = step;
  const inProgress = step.status === 'inProgress';
  const label = inProgress ? 'Continue' : START_LABELS[quest.type];

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <AppText variant="overline" color={inProgress ? 'reward' : 'wood'}>
          {inProgress ? 'In progress' : `Step ${index + 1} of ${total}`}
        </AppText>
        <Badge label={`+${quest.xpReward} XP`} tone="reward" />
      </View>
      <View style={styles.cardText}>
        <AppText variant="title2">{quest.title}</AppText>
        <AppText variant="caption" color="secondary">
          {`${quest.summary} · ${quest.estimatedMinutes} min`}
        </AppText>
      </View>
      {inProgress ? (
        <ProgressBar
          progress={Math.max(step.progress, 0.04)}
          height={6}
          accessibilityLabel={`${quest.title} progress`}
        />
      ) : null}
      <Button
        label={label}
        onPress={() => onOpen(step)}
        size="md"
        fullWidth
        sound="tapSoft"
        haptic="press"
        accessibilityLabel={`${label}: ${quest.title}, ${quest.xpReward} XP`}
        testID={`quest-cta-${quest.type}`}
      />
    </View>
  );
}

function StepSummary({ step }: { step: JourneyStep }) {
  const { quest } = step;
  const done = step.status === 'completed';
  const xp = done ? step.xpEarned : quest.xpReward;

  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}. ${quest.summary}. ${
        done ? `Completed, ${xp} XP earned.` : `Locked until the step before is done. ${xp} XP.`
      }`}
      style={styles.summary}>
      <View style={styles.summaryText}>
        <AppText variant="bodyStrong" color={done ? 'secondary' : 'tertiary'}>
          {quest.title}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {quest.summary}
        </AppText>
      </View>
      <AppText variant="label" color={done ? 'brand' : 'tertiary'}>
        {`+${xp} XP`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  body: { flex: 1, paddingBottom: spacing[5] },
  // As tall as the node beside it, so the text centres on the icon.
  summary: { minHeight: NODE_SIZE, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryText: { flex: 1, gap: 2 },
  card: {
    backgroundColor: colors.surface.base,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { gap: 2 },
});
