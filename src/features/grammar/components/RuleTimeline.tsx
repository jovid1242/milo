import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import type { GrammarTimeline } from '@/schemas';
import { colors, spacing } from '@/theme';

const WIDTH = 108;
const HEIGHT = 26;
const LINE_Y = 18;
const NOW_X = WIDTH - 7;
const EVENT_X = 26;

/**
 * The idea of a form as a tiny timeline, drawn like the trails on Home: a
 * point in the past on its own (finished), a past point joined to now
 * (connected), or the same thing again and again (a habit). Decorative: the
 * words next to it carry the meaning.
 */
export function RuleTimeline({ kind }: { kind: GrammarTimeline }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wrap}>
      <Svg width={WIDTH} height={HEIGHT}>
        <Line
          x1={4}
          y1={LINE_Y}
          x2={NOW_X}
          y2={LINE_Y}
          stroke={colors.border.default}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {kind === 'pastPoint' ? (
          <Circle cx={EVENT_X} cy={LINE_Y} r={5.5} fill={colors.wood.base} />
        ) : null}
        {kind === 'pastToNow' ? (
          <>
            <Path
              d={`M ${EVENT_X} ${LINE_Y} Q ${(EVENT_X + NOW_X) / 2} ${LINE_Y - 20} ${NOW_X} ${LINE_Y}`}
              stroke={colors.brand.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={EVENT_X} cy={LINE_Y} r={5.5} fill={colors.wood.base} />
          </>
        ) : null}
        {kind === 'repeated'
          ? [20, 40, 60, 80].map((x) => (
              <Circle key={x} cx={x} cy={LINE_Y} r={4} fill={colors.wood.base} />
            ))
          : null}
        <Circle cx={NOW_X} cy={LINE_Y} r={5} fill={colors.brand.primary} />
      </Svg>
      <View style={styles.labels}>
        <AppText variant="caption" color="tertiary">
          past
        </AppText>
        <AppText variant="caption" color="brand">
          now
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WIDTH, gap: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[0] },
});
