import { useLocalSearchParams } from 'expo-router';
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
import type { ReadingProgress, ReadingQuest } from '@/schemas';

import { ReadingPrompt } from './components/ReadingPrompt';
import { StoryRead } from './components/StoryRead';
import { StoryReader } from './components/StoryReader';
import { StorySheet } from './components/StorySheet';
import { WordSheet } from './components/WordSheet';
import { describeReadingQuestion } from './logic/question-view';
import {
  INITIAL_READING,
  currentQuestion,
  hasReadingProgress,
  readingProgress,
  readingStage,
  readingSteps,
  readingStepsDone,
  reduceReading,
  restoreReading,
  type ReadingAction,
} from './logic/reading-session';

const TITLE = 'Reading';

/**
 * The Reading quest. Opens where the user left off, or on the summary of a
 * finished quest (with an XP-free replay).
 */
export function ReadingQuestScreen({ questId }: { questId: string }) {
  const { query, mode, setMode, close } = useQuestScreen(questId);
  const run = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!run || mode === null) return <LoadingState />;

  const content = run.content?.type === 'reading' ? run.content : null;
  if (!content) {
    return (
      <>
        <QuestTopBar title={TITLE} stepLabel="" groups={[]} done={0} onClose={close} />
        <QuestUnavailable day={run.quest.day} onClose={close} />
      </>
    );
  }

  if (mode === 'completed' && run.completion) {
    const steps = readingSteps(content);
    return (
      <>
        <QuestTopBar
          title={TITLE}
          stepLabel="Done"
          groups={[steps.story, steps.questions]}
          done={steps.story + steps.questions}
          onClose={close}
        />
        <QuestCompleted
          completion={run.completion}
          onPracticeAgain={() => setMode('replay')}
          onClose={close}>
          <StoryRead story={content.story} />
        </QuestCompleted>
      </>
    );
  }

  return (
    <ReadingRun
      key={mode}
      run={run}
      content={content}
      mode={mode === 'replay' ? 'replay' : 'play'}
      onClose={close}
    />
  );
}

function stepLabelFor(state: ReadingProgress, content: ReadingQuest): string {
  switch (state.phase) {
    case 'intro':
      return 'Short story';
    case 'story':
      return state.reachedEnd ? 'The end' : `${content.story.estimatedMinutes} min read`;
    case 'questions':
      return `${state.practiceIndex + 1} of ${content.questions.length}`;
    case 'result':
      return 'Done';
  }
}

function ReadingRun({
  run,
  content: initialContent,
  mode,
  onClose,
}: {
  run: QuestRun;
  content: ReadingQuest;
  mode: RunMode;
  onClose: () => void;
}) {
  // The quest is fixed for this run, whatever refetches bring.
  const [content] = useState(initialContent);
  const [initial] = useState(() =>
    mode === 'replay' ? INITIAL_READING : restoreReading(content, run.savedState),
  );
  const flow = useQuestFlow(
    (state: ReadingProgress, action: ReadingAction) => reduceReading(content, state, action),
    initial,
    {
      questId: content.questId,
      mode,
      savedStartedAt: mode === 'replay' ? null : run.startedAt,
      exerciseCount: content.questions.length,
      stageOf: readingStage,
      progressOf: (state) => readingProgress(content, state),
      answersOf: (state) => state.answers,
    },
  );
  const { state, dispatch } = flow;
  const steps = readingSteps(content);

  // Development shortcut: `?devWord=<id>` opens a word card straight away.
  const { devWord } = useLocalSearchParams<{ devWord?: string }>();
  const [openWordId, setOpenWordId] = useState<string | null>(() =>
    __DEV__ && devWord && content.story.words.some((word) => word.id === devWord) ? devWord : null,
  );
  const [viewingStory, setViewingStory] = useState(false);

  const leave = () => void flow.flush().then(onClose);
  const exit = useExitQuest({
    confirm: mode === 'play' && flow.stage === 'playing' && hasReadingProgress(content, state),
    onExit: leave,
  });

  const openWord = (wordId: string) => {
    dispatch({ type: 'openWord', wordId });
    setOpenWordId(wordId);
  };

  const answer = (optionId: string) => {
    const question = currentQuestion(content, state);
    if (!question || answerFor(state.answers, question.id)) return;
    playAnswerFeedback(optionId === question.correctOptionId);
    dispatch({ type: 'answer', optionId, at: new Date().toISOString() });
  };

  let stage = null;
  if (state.phase === 'intro') {
    stage = (
      <QuestIntro
        mascot={mascots.reading}
        overline={`Day ${run.quest.day} · ${TITLE}`}
        title={content.story.title}
        subtitle={content.story.subtitle ?? run.quest.summary}
        duration={`${content.story.estimatedMinutes} min read`}
        tags={[content.story.level]}
        xpReward={run.quest.xpReward}
        replay={mode === 'replay'}
        ctaLabel="Start reading"
        ctaHint="Opens the story"
        onStart={() => dispatch({ type: 'start' })}
      />
    );
  } else if (state.phase === 'story') {
    stage = (
      <StoryReader
        story={content.story}
        initialParagraph={initial.phase === 'story' ? initial.paragraphIndex : 0}
        onOpenWord={openWord}
        onReadTo={(paragraphIndex) => dispatch({ type: 'readTo', paragraphIndex })}
        onReachEnd={() => dispatch({ type: 'reachEnd' })}
        onFinish={() => dispatch({ type: 'finishReading' })}
      />
    );
  } else if (state.phase === 'questions') {
    const question = currentQuestion(content, state);
    if (question) {
      const view = describeReadingQuestion(question);
      stage = (
        <ChoiceQuestion
          id={question.id}
          instruction={view.instruction}
          prompt={
            <ReadingPrompt question={question.question} onViewStory={() => setViewingStory(true)} />
          }
          options={view.options}
          correctOptionId={question.correctOptionId}
          answer={answerFor(state.answers, question.id)}
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
        takeaway="Story completed."
        result={flow.result}
        saveFailed={flow.saveFailed}
        onRetrySave={flow.retrySave}
        onContinue={leave}>
        <StoryRead story={content.story} />
      </QuestResult>
    );
  }

  return (
    <View style={styles.fill}>
      <QuestTopBar
        title={TITLE}
        stepLabel={stepLabelFor(state, content)}
        groups={[steps.story, steps.questions]}
        done={readingStepsDone(content, state)}
        onClose={exit.requestExit}
      />
      {stage}
      <WordSheet
        word={content.story.words.find((word) => word.id === openWordId) ?? null}
        onClose={() => setOpenWordId(null)}
      />
      <StorySheet
        story={content.story}
        visible={viewingStory}
        onClose={() => setViewingStory(false)}
      />
      <ExitQuestSheet {...exit.sheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
