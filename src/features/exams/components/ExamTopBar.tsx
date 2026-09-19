import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { colors, spacing } from '@/theme';

export type ExamProgress = {
  /** The question on screen, from 0. */
  index: number;
  /** Every question, in order: answered or not yet. */
  questions: readonly { id: string; answered: boolean }[];
};

export type ExamTopBarProps = {
  title: string;
  /** While answering; the intro and the result show just the title. */
  progress?: ExamProgress;
  onClose: () => void;
};

/**
 * The exam's header: leave, where you are ("8 / 15") and which questions are
 * answered — a filled segment is answered, an empty one is not, and the
 * current one stands taller.
 */
export function ExamTopBar({ title, progress, onClose }: ExamTopBarProps) {
  const total = progress?.questions.length ?? 0;
  const answeredCount = progress?.questions.filter((question) => question.answered).length ?? 0;
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <View style={styles.titleLayer}>
          <AppText variant="overline" color="wood" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
        </View>
        <IconButton
          icon={X}
          accessibilityLabel="Leave exam"
          onPress={onClose}
          style={styles.close}
          testID="exam-close"
        />
        {progress ? (
          <AppText
            variant="label"
            color="secondary"
            accessibilityLabel={`Question ${progress.index + 1} of ${total}`}
            testID="exam-step">
            {`${progress.index + 1} / ${total}`}
          </AppText>
        ) : null}
      </View>
      {progress ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${answeredCount} of ${total} questions answered`}
          accessibilityValue={{ min: 0, max: total, now: answeredCount }}
          style={styles.track}>
          {progress.questions.map((question, position) => (
            <View
              key={question.id}
              style={[
                styles.segment,
                question.answered ? styles.answered : styles.open,
                position === progress.index && styles.current,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  close: { marginLeft: -spacing[3] },
  track: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 12 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  answered: { backgroundColor: colors.brand.primary },
  open: { backgroundColor: colors.reward.track },
  current: {
    height: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.wood.dark,
  },
});
