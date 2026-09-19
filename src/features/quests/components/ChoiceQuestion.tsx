import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import type { ChoiceAnswer } from '@/schemas';
import { durations, spacing } from '@/theme';

import { AnswerFeedback } from './AnswerFeedback';
import { AnswerOption, type AnswerState } from './AnswerOption';
import { QuestStage } from './QuestStage';

export type ChoiceQuestionProps = {
  /** The exercise id: a new question fades in, the last one fades away. */
  id: string;
  /** Optional line above the instruction, e.g. which of today's quests it comes from. */
  label?: ReactNode;
  instruction: string;
  prompt: ReactNode;
  options: readonly { id: string; label: string }[];
  correctOptionId: string;
  answer: ChoiceAnswer | null;
  /** What the feedback says after a right or a wrong answer. */
  feedback: { correct: string; wrong: string };
  onAnswer: (optionId: string) => void;
  onContinue: () => void;
};

function stateOf(
  optionId: string,
  correctOptionId: string,
  answer: ChoiceAnswer | null,
): AnswerState {
  if (!answer) return 'idle';
  if (optionId === answer.optionId) return answer.correct ? 'correct' : 'wrong';
  if (optionId === correctOptionId) return 'answer';
  return 'dimmed';
}

/**
 * One practice question for any quest type: the prompt leads, calm options
 * below, and once answered the feedback with the way forward.
 */
export function ChoiceQuestion({
  id,
  label,
  instruction,
  prompt,
  options,
  correctOptionId,
  answer,
  feedback,
  onAnswer,
  onContinue,
}: ChoiceQuestionProps) {
  return (
    <QuestStage
      footer={
        answer ? (
          <AnswerFeedback
            correct={answer.correct}
            title={answer.correct ? 'Nice!' : 'Not quite'}
            detail={answer.correct ? feedback.correct : feedback.wrong}
            onContinue={onContinue}
          />
        ) : null
      }>
      <Animated.View
        key={id}
        entering={FadeIn.duration(durations.normal).delay(60)}
        exiting={FadeOut.duration(durations.fast)}
        style={styles.body}>
        <View style={styles.prompt}>
          {label}
          <AppText variant="overline" color="wood">
            {instruction}
          </AppText>
          {prompt}
        </View>
        <View style={styles.options}>
          {options.map((option, index) => (
            <AnswerOption
              key={option.id}
              label={option.label}
              state={stateOf(option.id, correctOptionId, answer)}
              onPress={() => onAnswer(option.id)}
              testID={`answer-${index}`}
            />
          ))}
        </View>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[8] },
  prompt: { gap: spacing[2] },
  options: { gap: spacing[3] },
});
