import { Check, ChevronLeft, Minus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, IconButton, PressableScale } from '@/components/ui';
import type { Exam, ExamAnswer } from '@/schemas';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, layout, radius, spacing } from '@/theme';

import { reviewExam } from '../logic/exam';
import type { ExamAction } from './ExamResult';
import { SECTION_LABELS } from './ExamQuestion';

type Reviewed = ReturnType<typeof reviewExam>[number];

export type ExamReviewProps = {
  exam: Exam;
  /** "Week 12 exam", "Final Battle". */
  title: string;
  answers: readonly ExamAnswer[];
  onBack: () => void;
  primary: ExamAction;
  secondary: ExamAction | null;
};

type Filter = 'mistakes' | 'all';

/**
 * After the exam: each question with your answer, the right one and why.
 * Mistakes first — that is what the review is for — with every question one tap away.
 */
export function ExamReview({ exam, title, answers, onBack, primary, secondary }: ExamReviewProps) {
  const items = reviewExam(exam, answers);
  const mistakes = items.filter((item) => !item.correct);
  const [filter, setFilter] = useState<Filter>(mistakes.length > 0 ? 'mistakes' : 'all');
  const shown = filter === 'mistakes' ? mistakes : items;

  return (
    <View style={styles.fill} testID="exam-review">
      <View style={styles.bar}>
        <View style={styles.titleLayer}>
          <AppText variant="overline" color="wood" accessibilityRole="header">
            {title}
          </AppText>
        </View>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Back to results"
          onPress={onBack}
          style={styles.back}
          testID="exam-review-back"
        />
      </View>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="title1" accessibilityRole="header">
            {mistakes.length > 0 ? 'Review mistakes' : 'Your answers'}
          </AppText>
          <AppText variant="body" color="secondary">
            {mistakes.length > 0
              ? `${mistakes.length} of ${items.length} to look at again. Each one comes with the right answer and why.`
              : 'Every answer right. Here they are, with the why behind each.'}
          </AppText>
        </View>
        {mistakes.length > 0 ? (
          <View style={styles.filters} accessibilityRole="tablist">
            <FilterChip
              label={`Mistakes (${mistakes.length})`}
              active={filter === 'mistakes'}
              onPress={() => setFilter('mistakes')}
            />
            <FilterChip
              label={`All (${items.length})`}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
          </View>
        ) : null}
        {shown.map((item) => (
          <ReviewCard key={item.question.id} item={item} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={primary.label}
          onPress={primary.onPress}
          fullWidth
          loading={primary.busy}
          disabled={primary.busy}
          testID="exam-review-primary"
        />
        {secondary ? (
          <Button
            label={secondary.label}
            onPress={secondary.onPress}
            fullWidth
            variant="ghost"
            loading={secondary.busy}
            disabled={secondary.busy}
            testID="exam-review-secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (active) return;
        triggerHaptic('selection');
        onPress();
      }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <AppText variant="label" color={active ? 'inverse' : 'secondary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function ReviewCard({ item }: { item: Reviewed }) {
  const { question, given, correct } = item;
  const text = (optionId: string | null) =>
    question.options.find((option) => option.id === optionId)?.text ?? null;
  const yours = text(given);
  const right = text(question.correctOptionId) ?? '';
  const verdict = correct ? 'right' : given === null ? 'not answered' : 'not right';

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        `Question ${item.number}, ${SECTION_LABELS[question.section]}. ${question.prompt}`,
        question.sentence ? question.sentence.replace('___', 'blank') : null,
        yours ? `Your answer: ${yours}, ${verdict}.` : 'Not answered.',
        correct ? null : `Correct answer: ${right}.`,
        question.explanation,
      ]
        .filter(Boolean)
        .join(' ')}
      testID={`exam-review-${question.id}`}>
      <AppText variant="overline" color="tertiary">
        {`Question ${item.number} · ${SECTION_LABELS[question.section]}`}
      </AppText>
      <AppText variant="bodyStrong">{question.prompt}</AppText>
      {question.sentence ? (
        <AppText variant="body" color="secondary">
          {question.sentence.replace('___', '______')}
        </AppText>
      ) : null}
      <View style={styles.answers}>
        <AnswerLine
          kind={correct ? 'right' : given === null ? 'empty' : 'wrong'}
          label="Your answer"
          value={yours ?? 'Not answered'}
        />
        {correct ? null : <AnswerLine kind="right" label="Correct answer" value={right} />}
      </View>
      <AppText variant="caption" color="secondary">
        {question.explanation}
      </AppText>
    </View>
  );
}

const MARKS = {
  right: { Icon: Check, background: colors.feedback.success, text: 'brand' },
  wrong: { Icon: X, background: colors.feedback.danger, text: 'danger' },
  empty: { Icon: Minus, background: colors.text.tertiary, text: 'secondary' },
} as const;

function AnswerLine({
  kind,
  label,
  value,
}: {
  kind: keyof typeof MARKS;
  label: string;
  value: string;
}) {
  const { Icon, background, text } = MARKS[kind];
  return (
    <View style={styles.answerLine}>
      <View style={[styles.mark, { backgroundColor: background }]}>
        <Icon size={12} strokeWidth={3} color={colors.text.inverse} />
      </View>
      <AppText variant="body" color={text} style={styles.answerText}>
        <AppText variant="label" color="secondary">{`${label}: `}</AppText>
        {value}
      </AppText>
    </View>
  );
}

const MARK = 20;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
  },
  titleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  back: { marginLeft: -spacing[3] },
  content: { gap: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[6] },
  heading: { gap: spacing[2] },
  filters: { flexDirection: 'row', gap: spacing[2] },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
  },
  chipIdle: {
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  chipActive: { backgroundColor: colors.wood.dark },
  card: {
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  answers: { gap: spacing[2], marginTop: spacing[1] },
  answerLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: { flex: 1 },
  footer: { paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[3] },
});
