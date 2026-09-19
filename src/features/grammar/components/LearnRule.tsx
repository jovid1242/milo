import { Lightbulb } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText, Badge, Button } from '@/components/ui';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { GrammarRule } from '@/schemas';
import { colors, durations, radius, spacing } from '@/theme';

import { MarkedText } from './MarkedText';
import { RuleTimeline } from './RuleTimeline';

export type LearnRuleProps = {
  rule: GrammarRule;
  onLearned: () => void;
};

/**
 * The rule at a glance: each form with its idea, a tiny timeline, one example
 * and the words that go with it — then one rule of thumb.
 */
export function LearnRule({ rule, onLearned }: LearnRuleProps) {
  return (
    <QuestStage
      footer={
        <Button label="See examples" onPress={onLearned} fullWidth testID="grammar-rule-next" />
      }>
      <Animated.View entering={FadeIn.duration(durations.normal)} style={styles.header}>
        <AppText variant="overline" color="wood">
          The rule
        </AppText>
        <AppText variant="title1" accessibilityRole="header">
          {rule.title}
        </AppText>
        {rule.lead ? (
          <AppText variant="bodyLarge" color="secondary">
            {rule.lead}
          </AppText>
        ) : null}
      </Animated.View>

      <View>
        {rule.points.map((point, index) => (
          <Fragment key={point.id}>
            {index > 0 ? <Versus /> : null}
            <Animated.View
              entering={FadeInDown.duration(durations.normal + 70).delay(120 + index * 140)}
              style={styles.point}>
              <View style={styles.pointHeader}>
                <View style={styles.pointTitle}>
                  <AppText variant="overline" color="wood">
                    {point.name}
                  </AppText>
                  <AppText variant="title3">{point.idea}</AppText>
                </View>
                {point.timeline ? <RuleTimeline kind={point.timeline} /> : null}
              </View>
              <MarkedText sentence={point.example} />
              {point.signals.length > 0 ? (
                <View
                  style={styles.signals}
                  accessible
                  accessibilityLabel={`Often with: ${point.signals.join(', ')}`}>
                  {point.signals.map((signal) => (
                    <Badge key={signal} label={signal} tone="wood" />
                  ))}
                </View>
              ) : null}
            </Animated.View>
          </Fragment>
        ))}
      </View>

      {rule.tip ? (
        <Animated.View
          entering={FadeIn.duration(durations.normal).delay(120 + rule.points.length * 140)}
          style={styles.tip}>
          <View style={styles.tipIcon}>
            <Lightbulb size={16} strokeWidth={2.5} color={colors.text.wood} />
          </View>
          <AppText variant="bodyMedium" style={styles.tipText}>
            {rule.tip}
          </AppText>
        </Animated.View>
      ) : null}
    </QuestStage>
  );
}

/** "vs" between two forms, on a thin line. */
function Versus() {
  return (
    <View style={styles.versus} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.versusLine} />
      <AppText variant="label" color="tertiary">
        vs
      </AppText>
      <View style={styles.versusLine} />
    </View>
  );
}

const TIP_ICON = 28;

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  point: {
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  pointHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  pointTitle: { flex: 1, gap: 2 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[6],
  },
  versusLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.default },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  tipIcon: {
    width: TIP_ICON,
    height: TIP_ICON,
    borderRadius: TIP_ICON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wood.light,
  },
  tipText: { flex: 1 },
});
