import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText, Badge, Button } from '@/components/ui';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { ThinkFirstHint } from '@/features/quests/components/ThinkFirstHint';
import type { GrammarExample, GrammarRulePoint } from '@/schemas';
import { colors, durations, spacing } from '@/theme';

import { MarkedText } from './MarkedText';
import { RuleTimeline } from './RuleTimeline';

export type GuidedExampleProps = {
  example: GrammarExample;
  point: GrammarRulePoint | null;
  revealed: boolean;
  isLast: boolean;
  onReveal: () => void;
  onNext: () => void;
};

/**
 * One example to think through: read the sentence, guess why, then "Show why"
 * lights up the parts that decide it and gives the reason. Not scored.
 */
export function GuidedExample({
  example,
  point,
  revealed,
  isLast,
  onReveal,
  onNext,
}: GuidedExampleProps) {
  return (
    <QuestStage
      footer={
        revealed ? (
          <Button
            label={isLast ? 'Start practice' : 'Next example'}
            onPress={onNext}
            fullWidth
            testID="grammar-example-next"
          />
        ) : (
          <Button
            label="Show why"
            variant="secondary"
            onPress={onReveal}
            fullWidth
            testID="grammar-example-reveal"
          />
        )
      }>
      <Animated.View
        key={example.id}
        entering={FadeIn.duration(durations.normal)}
        style={styles.sentence}>
        <AppText variant="overline" color="wood">
          Guided example
        </AppText>
        {/* Re-keyed on reveal: the marks fade in over the plain sentence. */}
        <Animated.View
          key={revealed ? 'marked' : 'plain'}
          entering={revealed ? FadeIn.duration(durations.slow) : undefined}>
          <MarkedText sentence={example.sentence} variant="title1" showMarks={revealed} />
        </Animated.View>
        <AppText variant="title3" color="secondary">
          {example.question}
        </AppText>
      </Animated.View>

      {revealed ? (
        <Animated.View entering={FadeInDown.duration(durations.normal)} style={styles.why}>
          {point ? (
            <View style={styles.whyHeader}>
              <Badge label={point.name} tone="brand" />
              {point.timeline ? <RuleTimeline kind={point.timeline} /> : null}
            </View>
          ) : null}
          <AppText variant="bodyLarge">{example.explanation}</AppText>
        </Animated.View>
      ) : (
        <ThinkFirstHint
          key={`hint-${example.id}`}
          title="Think first"
          message="What in the sentence tells you? Then tap to check."
          accessibilityLabel="Show why"
          onReveal={onReveal}
        />
      )}
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  sentence: { gap: spacing[3] },
  why: {
    gap: spacing[3],
    paddingLeft: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.brand.tint,
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
});
