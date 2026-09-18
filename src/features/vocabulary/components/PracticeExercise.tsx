import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { AnswerFeedback } from '@/features/quests/components/AnswerFeedback';
import { AnswerOption, type AnswerState } from '@/features/quests/components/AnswerOption';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { VocabularyAnswer, VocabularyExercise } from '@/schemas';
import { colors, durations, spacing } from '@/theme';

import type { ExerciseView } from '../logic/exercise-view';

export type PracticeExerciseProps = {
  exercise: VocabularyExercise;
  view: ExerciseView;
  answer: VocabularyAnswer | null;
  onAnswer: (optionItemId: string) => void;
  onContinue: () => void;
};

function stateOf(
  optionItemId: string,
  exercise: VocabularyExercise,
  answer: VocabularyAnswer | null,
): AnswerState {
  if (!answer) return 'idle';
  if (optionItemId === answer.optionItemId) return answer.correct ? 'correct' : 'wrong';
  if (optionItemId === exercise.itemId) return 'answer';
  return 'dimmed';
}

/** One practice question: the prompt leads, four calm options, feedback below. */
export function PracticeExercise({
  exercise,
  view,
  answer,
  onAnswer,
  onContinue,
}: PracticeExerciseProps) {
  return (
    <QuestStage
      footer={
        answer ? (
          <AnswerFeedback
            correct={answer.correct}
            title={answer.correct ? 'Nice!' : 'Not quite'}
            detail={answer.correct ? view.pair : `The answer is “${view.answerLabel}”.`}
            onContinue={onContinue}
          />
        ) : null
      }>
      {/* Keyed per exercise: the next question fades in, the last one fades away. */}
      <Animated.View
        key={exercise.id}
        entering={FadeIn.duration(durations.normal).delay(60)}
        exiting={FadeOut.duration(durations.fast)}
        style={styles.body}>
        <View style={styles.prompt}>
          <AppText variant="overline" color="wood">
            {view.instruction}
          </AppText>
          {view.sentence ? (
            <AppText variant="title1" accessibilityRole="header">
              {view.sentence.before}
              <AppText variant="title1" color={answer ? 'brand' : 'wood'} style={styles.gap}>
                {answer ? view.answerLabel : '______'}
              </AppText>
              {view.sentence.after}
            </AppText>
          ) : (
            <AppText variant="display" accessibilityRole="header">
              {view.prompt}
            </AppText>
          )}
        </View>

        <View style={styles.options}>
          {view.options.map((option, index) => (
            <AnswerOption
              key={option.itemId}
              label={option.label}
              state={stateOf(option.itemId, exercise, answer)}
              onPress={() => onAnswer(option.itemId)}
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
  gap: { textDecorationLine: 'underline', textDecorationColor: colors.wood.light },
  options: { gap: spacing[3] },
});
