import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { ChoiceQuestion } from '@/features/quests/components/ChoiceQuestion';
import { ExitQuestSheet } from '@/features/quests/components/ExitQuestSheet';
import { QuestCompleted } from '@/features/quests/components/QuestCompleted';
import { QuestIntro } from '@/features/quests/components/QuestIntro';
import { QuestResult } from '@/features/quests/components/QuestResult';
import { QuestTopBar } from '@/features/quests/components/QuestTopBar';
import { QuestUnavailable } from '@/features/quests/components/QuestUnavailable';
import { useExitQuest } from '@/features/quests/hooks/use-exit-quest';
import {
  playAnswerFeedback,
  useQuestFlow,
  type RunMode,
} from '@/features/quests/hooks/use-quest-flow';
import { useQuestScreen } from '@/features/quests/hooks/use-quest-screen';
import { answerFor } from '@/features/quests/logic/practice';
import type { QuestRun } from '@/features/quests/use-cases';
import type { VocabularyProgress, VocabularyQuest } from '@/schemas';

import { LearnWord } from './components/LearnWord';
import { VocabularyPrompt } from './components/VocabularyPrompt';
import { WordChips } from './components/WordChips';
import { describeExercise } from './logic/exercise-view';
import {
  INITIAL_PROGRESS,
  currentExercise,
  currentItem,
  hasProgress,
  progressFraction,
  reduceVocabulary,
  restoreProgress,
  vocabularyStage,
  vocabularyStepsDone,
  type VocabularyAction,
} from './logic/vocabulary-session';

const TITLE = 'Vocabulary';

/**
 * The Vocabulary quest. Opens where the user left off, or on the summary of a
 * finished quest (with an XP-free replay).
 */
export function VocabularyQuestScreen({ questId }: { questId: string }) {
  const { query, mode, setMode, close } = useQuestScreen(questId);
  const run = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!run || mode === null) return <LoadingState />;

  const content = run.content?.type === 'vocabulary' ? run.content : null;
  if (!content) {
    return (
      <>
        <QuestTopBar title={TITLE} stepLabel="" groups={[]} done={0} onClose={close} />
        <QuestUnavailable day={run.quest.day} onClose={close} />
      </>
    );
  }

  if (mode === 'completed' && run.completion) {
    return (
      <>
        <QuestTopBar
          title={TITLE}
          stepLabel="Done"
          groups={[content.items.length, content.exercises.length]}
          done={content.items.length + content.exercises.length}
          onClose={close}
        />
        <QuestCompleted
          completion={run.completion}
          onPracticeAgain={() => setMode('replay')}
          onClose={close}>
          <WordChips words={content.items.map((item) => item.word)} />
        </QuestCompleted>
      </>
    );
  }

  return (
    <VocabularyRun
      key={mode}
      run={run}
      content={content}
      mode={mode === 'replay' ? 'replay' : 'play'}
      onClose={close}
    />
  );
}

function stepLabelFor(state: VocabularyProgress, content: VocabularyQuest): string {
  switch (state.phase) {
    case 'intro':
      return `${content.items.length} words`;
    case 'learn':
      return `Word ${state.learnIndex + 1} of ${content.items.length}`;
    case 'practice':
      return `${state.practiceIndex + 1} of ${content.exercises.length}`;
    case 'result':
      return 'Done';
  }
}

function VocabularyRun({
  run,
  content: initialContent,
  mode,
  onClose,
}: {
  run: QuestRun;
  content: VocabularyQuest;
  mode: RunMode;
  onClose: () => void;
}) {
  // The quest is fixed for this run, whatever refetches bring.
  const [content] = useState(initialContent);
  const [initial] = useState(() =>
    mode === 'replay' ? INITIAL_PROGRESS : restoreProgress(content, run.savedState),
  );
  const flow = useQuestFlow(
    (state: VocabularyProgress, action: VocabularyAction) =>
      reduceVocabulary(content, state, action),
    initial,
    {
      questId: content.questId,
      mode,
      savedStartedAt: mode === 'replay' ? null : run.startedAt,
      exerciseCount: content.exercises.length,
      stageOf: vocabularyStage,
      progressOf: (state) => progressFraction(content, state),
      answersOf: (state) => state.answers,
    },
  );
  const { state, dispatch } = flow;

  const leave = () => void flow.flush().then(onClose);
  const exit = useExitQuest({
    confirm: mode === 'play' && flow.stage === 'playing' && hasProgress(state),
    onExit: leave,
  });

  const answer = (optionId: string) => {
    const exercise = currentExercise(content, state);
    if (!exercise || answerFor(state.answers, exercise.id)) return;
    playAnswerFeedback(optionId === exercise.itemId);
    dispatch({ type: 'answer', optionId, at: new Date().toISOString() });
  };

  let stage = null;
  if (state.phase === 'intro') {
    stage = (
      <QuestIntro
        mascot={mascots.vocabulary}
        overline={`Day ${run.quest.day} · ${TITLE}`}
        title={`${content.items.length} new words`}
        subtitle="Meet each word, then use it."
        duration={`about ${run.quest.estimatedMinutes} min`}
        xpReward={run.quest.xpReward}
        replay={mode === 'replay'}
        ctaLabel="Start"
        ctaHint="Begins with the first new word"
        onStart={() => dispatch({ type: 'start' })}
      />
    );
  } else if (state.phase === 'learn') {
    const item = currentItem(content, state);
    if (item) {
      stage = (
        <LearnWord
          item={item}
          revealed={state.revealed}
          onReveal={() => dispatch({ type: 'reveal' })}
          onLearned={() => dispatch({ type: 'learned' })}
        />
      );
    }
  } else if (state.phase === 'practice') {
    const exercise = currentExercise(content, state);
    if (exercise) {
      const view = describeExercise(content, exercise);
      const given = answerFor(state.answers, exercise.id);
      stage = (
        <ChoiceQuestion
          id={exercise.id}
          instruction={view.instruction}
          prompt={<VocabularyPrompt view={view} answered={given !== null} />}
          options={view.options}
          correctOptionId={exercise.itemId}
          answer={given}
          feedback={view.feedback}
          onAnswer={answer}
          onContinue={() => dispatch({ type: 'continue' })}
        />
      );
    }
  } else if (flow.result) {
    stage = (
      <QuestResult
        questLabel={TITLE}
        takeaway={`${content.items.length} new words for the journey.`}
        result={flow.result}
        extraStats={[{ label: 'words', value: String(content.items.length) }]}
        saveFailed={flow.saveFailed}
        onRetrySave={flow.retrySave}
        onContinue={leave}>
        <WordChips words={content.items.map((item) => item.word)} />
      </QuestResult>
    );
  }

  return (
    <View style={styles.fill}>
      <QuestTopBar
        title={TITLE}
        stepLabel={stepLabelFor(state, content)}
        groups={[content.items.length, content.exercises.length]}
        done={vocabularyStepsDone(content, state)}
        onClose={exit.requestExit}
      />
      {stage}
      <ExitQuestSheet {...exit.sheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
