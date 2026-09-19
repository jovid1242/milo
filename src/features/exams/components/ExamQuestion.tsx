import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { GapSentence } from '@/features/quests/components/GapSentence';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { Exam, ExamQuestion as Question, ExamSection } from '@/schemas';
import { durations, spacing } from '@/theme';

import { ExamOption } from './ExamOption';
import { ExamPassage } from './ExamPassage';

export const SECTION_LABELS: Record<ExamSection, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Reading',
};

const LETTERS = ['A', 'B', 'C', 'D'];

export type ExamQuestionProps = {
  exam: Exam;
  question: Question;
  /** The option chosen so far, if any. */
  selected: string | null;
  passageOpen: boolean;
  onTogglePassage: () => void;
  onSelect: (optionId: string) => void;
  /** Previous / Next / Finish exam. */
  footer: ReactNode;
};

/**
 * One exam question: where it comes from, the text for reading questions, the
 * question and its options. A gap sentence shows the chosen word in place —
 * as a draft, in neutral ink; right and wrong come only after the exam.
 */
export function ExamQuestion({
  exam,
  question,
  selected,
  passageOpen,
  onTogglePassage,
  onSelect,
  footer,
}: ExamQuestionProps) {
  const passage = question.passageId
    ? (exam.passages.find((item) => item.id === question.passageId) ?? null)
    : null;
  const [before = '', after = ''] = question.sentence?.split('___') ?? [];
  const chosen = question.options.find((option) => option.id === selected)?.text ?? null;

  return (
    // A new question starts at the top.
    <QuestStage key={question.id} footer={footer}>
      <Animated.View entering={FadeIn.duration(durations.normal)} style={styles.body}>
        <AppText variant="overline" color="wood">
          {`${SECTION_LABELS[question.section]} · Day ${question.sourceDay}`}
        </AppText>
        {passage ? (
          <ExamPassage passage={passage} open={passageOpen} onToggle={onTogglePassage} />
        ) : null}
        <View style={styles.prompt}>
          <AppText variant="title2" accessibilityRole="header">
            {question.prompt}
          </AppText>
          {question.sentence ? (
            <GapSentence
              before={before}
              after={after}
              fill={chosen}
              fillColor="primary"
              variant="title3"
            />
          ) : null}
        </View>
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Answers">
          {question.options.map((option, index) => (
            <ExamOption
              key={option.id}
              letter={LETTERS[index] ?? String(index + 1)}
              label={option.text}
              selected={option.id === selected}
              onPress={() => onSelect(option.id)}
              testID={`exam-option-${option.id}`}
            />
          ))}
        </View>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[5] },
  prompt: { gap: spacing[3] },
  options: { gap: spacing[3] },
});
