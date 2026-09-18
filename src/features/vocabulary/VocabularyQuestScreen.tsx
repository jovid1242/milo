import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { ConfirmSheet, LoadingState, Screen } from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { invalidateProgress } from '@/features/progress/queries';
import { QuestTopBar } from '@/features/quests/components/QuestTopBar';
import { QuestUnavailable } from '@/features/quests/components/QuestUnavailable';
import type { VocabularyPhase, VocabularyProgress, VocabularyQuest } from '@/schemas';

import { LearnWord } from './components/LearnWord';
import { PracticeExercise } from './components/PracticeExercise';
import { VocabularyCompleted } from './components/VocabularyCompleted';
import { VocabularyIntro } from './components/VocabularyIntro';
import { VocabularyResult } from './components/VocabularyResult';
import { useVocabularyFlow, type FlowMode } from './hooks/use-vocabulary-flow';
import { describeExercise } from './logic/exercise-view';
import {
  INITIAL_PROGRESS,
  answerFor,
  currentExercise,
  currentItem,
  hasProgress,
} from './logic/vocabulary-session';
import { useVocabularyQuest } from './queries';
import type { VocabularyQuestData } from './use-cases';

type Mode = FlowMode | 'completed';

/**
 * The Vocabulary quest, full screen: no tab bar, one close button. Opens where
 * the user left off, or on the result of a finished quest.
 */
export function VocabularyQuestScreen({ questId }: { questId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useVocabularyQuest(questId);
  // Decided once, from fresh data: later refetches must not swap the screen.
  const [mode, setMode] = useState<Mode | null>(null);
  const data = query.data;
  const ready = data !== undefined && !query.isFetching;
  if (ready && mode === null) setMode(data.completion ? 'completed' : 'play');

  const close = () => {
    invalidateProgress(queryClient);
    router.back();
  };

  let body: ReactNode;
  if (query.isError) {
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!data || mode === null) {
    body = <LoadingState />;
  } else if (!data.content) {
    body = (
      <>
        <QuestTopBar title="Vocabulary" stepLabel="" groups={[]} done={0} onClose={close} />
        <QuestUnavailable day={data.quest.day} onClose={close} />
      </>
    );
  } else if (mode === 'completed' && data.completion) {
    const total = data.content.items.length + data.content.exercises.length;
    body = (
      <>
        <QuestTopBar
          title="Vocabulary"
          stepLabel="Done"
          groups={[data.content.items.length, data.content.exercises.length]}
          done={total}
          onClose={close}
        />
        <VocabularyCompleted
          completion={data.completion}
          words={data.content.items.map((item) => item.word)}
          onPracticeAgain={() => setMode('replay')}
          onClose={close}
        />
      </>
    );
  } else {
    body = (
      <VocabularyFlow
        key={mode}
        data={data}
        content={data.content}
        mode={mode === 'replay' ? 'replay' : 'play'}
        onClose={close}
      />
    );
  }

  return (
    <Screen fullScreenModal edges={['top', 'bottom']} background="warm" testID="vocabulary-quest">
      <View style={styles.fill}>{body}</View>
    </Screen>
  );
}

function stepLabelFor(phase: VocabularyPhase, state: VocabularyProgress, content: VocabularyQuest) {
  switch (phase) {
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

function VocabularyFlow({
  data,
  content: initialContent,
  mode,
  onClose,
}: {
  data: VocabularyQuestData;
  content: VocabularyQuest;
  mode: FlowMode;
  onClose: () => void;
}) {
  // The quest is fixed for this run, whatever refetches bring.
  const [content] = useState(initialContent);
  const flow = useVocabularyFlow({
    content,
    initial: mode === 'replay' ? INITIAL_PROGRESS : data.progress,
    savedStartedAt: mode === 'replay' ? null : data.startedAt,
    mode,
    perfectBonusXp: CHALLENGE.perfectScoreBonusXp,
  });
  const { state } = flow;
  const [confirming, setConfirming] = useState(false);

  const leave = () => {
    void flow.flush().then(onClose);
  };
  const requestClose = () => {
    if (mode === 'play' && state.phase !== 'result' && hasProgress(state)) setConfirming(true);
    else leave();
  };

  // Android's back button asks the same question as the close button. (The
  // quest is a full-screen modal: it is focused for as long as it is mounted.)
  const onHardwareBack = useEffectEvent(() => requestClose());
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onHardwareBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const itemCount = content.items.length;
  const exerciseCount = content.exercises.length;
  const done =
    state.phase === 'result'
      ? itemCount + exerciseCount
      : state.learnedItemIds.length + state.answers.length;

  let stage: ReactNode = null;
  if (state.phase === 'intro') {
    stage = (
      <VocabularyIntro
        quest={data.quest}
        wordCount={itemCount}
        replay={mode === 'replay'}
        onStart={flow.start}
      />
    );
  } else if (state.phase === 'learn') {
    const item = currentItem(content, state);
    if (item) {
      stage = (
        <LearnWord
          item={item}
          revealed={state.revealed}
          onReveal={flow.reveal}
          onLearned={flow.learned}
        />
      );
    }
  } else if (state.phase === 'practice') {
    const exercise = currentExercise(content, state);
    if (exercise) {
      stage = (
        <PracticeExercise
          exercise={exercise}
          view={describeExercise(content, exercise)}
          answer={answerFor(state, exercise.id)}
          onAnswer={flow.answer}
          onContinue={flow.next}
        />
      );
    }
  } else if (flow.summary) {
    stage = (
      <VocabularyResult
        summary={flow.summary}
        saveFailed={flow.saveFailed}
        onRetrySave={flow.retrySave}
        onContinue={leave}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <QuestTopBar
        title="Vocabulary"
        stepLabel={stepLabelFor(state.phase, state, content)}
        groups={[itemCount, exerciseCount]}
        done={done}
        onClose={requestClose}
      />
      {stage}
      <ConfirmSheet
        visible={confirming}
        title="Leave this quest?"
        message="Your progress will be saved."
        stayLabel="Keep learning"
        leaveLabel="Leave"
        onStay={() => setConfirming(false)}
        onLeave={() => {
          setConfirming(false);
          leave();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
