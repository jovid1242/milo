import { Check, Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { QuestIcon } from '@/features/quests/components/QuestIcon';
import { colors, radius, shadows, springs } from '@/theme';

import type { JourneyStep } from '../logic/today-journey';

export const NODE_SIZE = 44;
const CURRENT_ICON = 48;
const RING_STROKE = 2.5;
const RING_GAP = 3;
export const CURRENT_NODE_SIZE = CURRENT_ICON + 2 * (RING_GAP + RING_STROKE);

export type QuestNodeProps = {
  step: JourneyStep;
  /** Set when this quest was just completed: the check pops in. */
  celebrateKey: number | null;
};

/**
 * One waypoint of today's route, drawn with the quest's own icon. The current
 * quest wears a ring (a gold arc while in progress), done quests a green check,
 * locked ones fade back.
 */
export function QuestNode({ step, celebrateKey }: QuestNodeProps) {
  const { status, quest } = step;
  const reduceMotion = useReducedMotion();
  const bump = useSharedValue(1);
  const check = useSharedValue(status === 'completed' ? 1 : 0);

  useEffect(() => {
    if (status !== 'completed') {
      check.set(0);
      return;
    }
    if (celebrateKey === null || reduceMotion) {
      check.set(1);
      return;
    }
    bump.set(withSequence(withTiming(1.12, { duration: 140 }), withSpring(1, springs.bouncy)));
    check.set(withSequence(withTiming(0, { duration: 0 }), withDelay(90, withSpring(1, springs.bouncy))));
  }, [status, celebrateKey, reduceMotion, bump, check]);

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, check.get() * 2),
    transform: [{ scale: check.get() }],
  }));

  if (status === 'available' || status === 'inProgress') {
    return (
      <View style={styles.current}>
        <ProgressRing progress={status === 'inProgress' ? step.progress : null} />
        <QuestIcon type={quest.type} size={CURRENT_ICON} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.node, bumpStyle]}>
      <View style={status === 'locked' ? styles.faded : null}>
        <QuestIcon type={quest.type} size={NODE_SIZE} />
      </View>
      {status === 'completed' ? (
        <Animated.View style={[styles.badge, styles.checkBadge, checkStyle]}>
          <Check size={11} color={colors.text.inverse} strokeWidth={3.5} />
        </Animated.View>
      ) : (
        <View style={[styles.badge, styles.lockBadge]}>
          <Lock size={10} color={colors.text.tertiary} strokeWidth={2.5} />
        </View>
      )}
    </Animated.View>
  );
}

/**
 * Rounded-square ring that follows the icon's shape. `null` = ready to start
 * (full forest ring); a number = in progress (gold arc over a soft track).
 */
function ProgressRing({ progress }: { progress: number | null }) {
  const size = CURRENT_NODE_SIZE;
  const side = size - RING_STROKE;
  const corner = side * 0.3;
  const perimeter = 4 * side - 8 * corner + 2 * Math.PI * corner;
  const shown = progress === null ? 1 : Math.max(0.06, Math.min(1, progress));

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Rect
        x={RING_STROKE / 2}
        y={RING_STROKE / 2}
        width={side}
        height={side}
        rx={corner}
        fill={colors.surface.base}
        stroke={progress === null ? colors.brand.primary : colors.reward.goldSoft}
        strokeWidth={RING_STROKE}
      />
      {progress !== null ? (
        <Rect
          x={RING_STROKE / 2}
          y={RING_STROKE / 2}
          width={side}
          height={side}
          rx={corner}
          fill="none"
          stroke={colors.reward.goldDeep}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${perimeter * shown} ${perimeter}`}
        />
      ) : null}
    </Svg>
  );
}

const BADGE = 18;

const styles = StyleSheet.create({
  node: { width: NODE_SIZE, height: NODE_SIZE },
  current: {
    width: CURRENT_NODE_SIZE,
    height: CURRENT_NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CURRENT_NODE_SIZE * 0.3,
    ...shadows.subtle,
  },
  faded: { opacity: 0.45 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: BADGE,
    height: BADGE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.warm,
  },
  checkBadge: { backgroundColor: colors.feedback.success },
  lockBadge: { backgroundColor: colors.surface.warmStrong },
});
