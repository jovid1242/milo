import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';

import { AppText, Badge, Button, PressableScale } from '@/components/ui';
import type { QuestType } from '@/schemas';
import { colors, durations, radius, shadows, spacing } from '@/theme';

import type { JourneyStep } from '../logic/today-journey';
import { CURRENT_NODE_SIZE, DONE_NODE_SIZE, QuestNode, UPCOMING_NODE_SIZE } from './QuestNode';
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
  finalBattle: 'Climb to the summit',
};

/**
 * A waypoint on the rail, its trail below, and what to do there. Three levels
 * of emphasis: done steps shrink to one quiet line, the current step is the one
 * card on the screen, upcoming steps preview what is ahead.
 */
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
          key={step.status === 'completed' ? 'done' : isCurrent ? 'current' : 'upcoming'}
          entering={FadeIn.duration(durations.normal).delay(isCurrent ? 180 : 0)}
          style={[styles.body, isCurrent && styles.bodyCurrent]}>
          {isCurrent ? (
            <CurrentQuestCard step={step} index={index} total={total} onOpen={onOpen} />
          ) : step.status === 'completed' ? (
            <DoneStep step={step} onOpen={onOpen} />
          ) : (
            <UpcomingStep step={step} />
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
  // The Final Battle stays open until it is passed: after a try, another one.
  const notYet = step.examResult === 'notPassed' && !inProgress;
  const label = inProgress ? 'Continue' : notYet ? 'Try again' : START_LABELS[quest.type];

  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <AppText variant="overline" color={inProgress ? 'reward' : 'wood'}>
          {inProgress
            ? step.progress > 0
              ? `In progress · ${Math.round(step.progress * 100)}%`
              : 'In progress'
            : notYet
              ? 'Not passed yet · the summit waits'
              : `Step ${index + 1} of ${total}`}
        </AppText>
        <View style={styles.titleRow}>
          <AppText variant="title2" style={styles.title}>
            {quest.title}
          </AppText>
          <Badge label={`+${quest.xpReward} XP`} tone="reward" />
        </View>
        <AppText variant="caption" color="secondary">
          {`${quest.summary} · ${quest.estimatedMinutes} min`}
        </AppText>
      </View>
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

function DoneStep({ step, onOpen }: { step: JourneyStep; onOpen: (step: JourneyStep) => void }) {
  const { quest, examResult } = step;
  if (examResult) return <DoneExamStep step={step} onOpen={onOpen} />;
  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}. Completed, ${step.xpEarned} XP earned.`}
      style={[styles.line, { minHeight: DONE_NODE_SIZE }]}>
      <AppText variant="bodyMedium" color="secondary" numberOfLines={1} style={styles.lineTitle}>
        {quest.title}
      </AppText>
      <AppText variant="label" color="brand">
        {`+${step.xpEarned} XP`}
      </AppText>
    </View>
  );
}

/**
 * A handed-in exam says how it went — never "+0 XP" — and stays one tap away:
 * its result, the review, another try.
 */
function DoneExamStep({
  step,
  onOpen,
}: {
  step: JourneyStep;
  onOpen: (step: JourneyStep) => void;
}) {
  const { quest } = step;
  const passed = step.examResult === 'passed';
  const status = passed
    ? step.xpEarned > 0
      ? `Passed · +${step.xpEarned} XP`
      : 'Passed'
    : 'Not passed yet';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${quest.title}. ${passed ? `Passed${step.xpEarned > 0 ? `, ${step.xpEarned} XP earned` : ''}` : 'Handed in, not passed yet'}.`}
      accessibilityHint={passed ? 'Opens your result' : 'Opens your result and another try'}
      onPress={() => onOpen(step)}
      style={[styles.line, { minHeight: DONE_NODE_SIZE }]}
      testID="quest-done-weeklyExam">
      <AppText variant="bodyMedium" color="secondary" numberOfLines={1} style={styles.lineTitle}>
        {quest.title}
      </AppText>
      <AppText variant="label" color={passed ? 'brand' : 'secondary'}>
        {status}
      </AppText>
    </PressableScale>
  );
}

function UpcomingStep({ step }: { step: JourneyStep }) {
  const { quest } = step;
  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}. ${quest.summary}. Locked until the step before is done. ${quest.xpReward} XP.`}
      style={[styles.line, { minHeight: UPCOMING_NODE_SIZE }]}>
      <View style={styles.lineTitle}>
        <AppText variant="bodyStrong" color="tertiary">
          {quest.title}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {quest.summary}
        </AppText>
      </View>
      <AppText variant="label" color="tertiary">
        {`+${quest.xpReward} XP`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  body: { flex: 1, paddingBottom: spacing[3] },
  bodyCurrent: { paddingBottom: spacing[5] },
  // As tall as the node beside it, so the text centres on the icon.
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  lineTitle: { flex: 1, gap: 2 },
  card: {
    backgroundColor: colors.surface.base,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[4],
    ...shadows.card,
  },
  cardText: { gap: spacing[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1 },
});
