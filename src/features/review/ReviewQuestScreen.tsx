import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { useFinishDay } from '@/features/day-complete/queries';
import { GrammarPrompt } from '@/features/grammar/components/GrammarPrompt';
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
import { ReadingPrompt } from '@/features/reading/components/ReadingPrompt';
import { VocabularyPrompt } from '@/features/vocabulary/components/VocabularyPrompt';
import { logger } from '@/lib/logger';
import type { ReviewProgress, ReviewQuest } from '@/schemas';

import { ReviewBreakdown } from './components/ReviewBreakdown';
import { ReviewSourceTag } from './components/ReviewSourceTag';
import { resolveReview, reviewMaterial, type ReviewItem } from './logic/review-items';
import {
  INITIAL_REVIEW,
  currentItem,
  hasReviewProgress,
  restoreReview,
  reduceReview,
  reviewProgress,
  reviewSources,
  reviewStage,
  reviewStepsDone,
  scoreReview,
  type ReviewAction,
} from './logic/review-session';

const TITLE = 'Review';

/**
 * The Review quest: a quick mixed recap of today's words, rule and story. As
 * the day's last quest, its result leads on to finishing the day.
 */
export function ReviewQuestScreen({ questId }: { questId: string }) {
  const { query, mode, setMode, close } = useQuestScreen(questId);
  const run = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!run || mode === null) return <LoadingState />;

  const content = run.content?.type === 'review' ? run.content : null;
  const items = content ? resolveReview(content, reviewMaterial(content, run.sources)) : [];
  if (!content || items.length === 0) {
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
          groups={[items.length]}
          done={items.length}
          onClose={close}
        />
        <QuestCompleted
          completion={run.completion}
          onPracticeAgain={() => setMode('replay')}
          onClose={close}
        />
      </>
    );
  }

  return (
    <ReviewRun
      key={mode}
      run={run}
      content={content}
      items={items}
      mode={mode === 'replay' ? 'replay' : 'play'}
      onClose={close}
    />
  );
}

function stepLabelFor(state: ReviewProgress, items: readonly ReviewItem[]): string {
  switch (state.phase) {
    case 'intro':
      return 'Quick recap';
    case 'practice':
      return `${state.practiceIndex + 1} of ${items.length}`;
    case 'result':
      return 'Done';
  }
}

function ReviewPrompt({ item, answered }: { item: ReviewItem; answered: boolean }) {
  switch (item.source) {
    case 'vocabulary':
      return <VocabularyPrompt view={item.view} answered={answered} />;
    case 'grammar':
      return <GrammarPrompt view={item.view} answered={answered} />;
    case 'reading':
      return <ReadingPrompt question={item.question} snippet={item.snippet} />;
  }
}

function ReviewRun({
  run,
  content,
  items: resolvedItems,
  mode,
  onClose,
}: {
  run: QuestRun;
  content: ReviewQuest;
  items: ReviewItem[];
  mode: RunMode;
  onClose: () => void;
}) {
  // The exercises are fixed for this run, whatever refetches bring.
  const [items] = useState(resolvedItems);
  const router = useRouter();
  const finishDay = useFinishDay();
  const [initial] = useState(() =>
    mode === 'replay' ? INITIAL_REVIEW : restoreReview(items, run.savedState),
  );
  const flow = useQuestFlow(
    (state: ReviewProgress, action: ReviewAction) => reduceReview(items, state, action),
    initial,
    {
      questId: content.questId,
      mode,
      savedStartedAt: mode === 'replay' ? null : run.startedAt,
      exerciseCount: items.length,
      stageOf: reviewStage,
      progressOf: (state) => reviewProgress(items, state),
      answersOf: (state) => state.answers,
      // The day's own celebration follows: one moment at a time.
      perfectMoment: false,
    },
  );
  const { state, dispatch } = flow;
  const day = run.quest.day;
  const finishing = useRef(false);
  const [finishingDay, setFinishingDay] = useState(false);

  const leave = () => void flow.flush().then(onClose);
  const exit = useExitQuest({
    confirm: mode === 'play' && flow.stage === 'playing' && hasReviewProgress(state),
    onExit: leave,
  });

  const answer = (optionId: string) => {
    const item = currentItem(items, state);
    if (!item || answerFor(state.answers, item.id)) return;
    playAnswerFeedback(optionId === item.choice.correctOptionId);
    dispatch({ type: 'answer', optionId, at: new Date().toISOString() });
  };

  // Finishing the day is idempotent (the quest completion already recorded
  // it); the guard only keeps a double tap from opening the summary twice.
  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    setFinishingDay(true);
    flow
      .flush()
      .then(() => finishDay.mutateAsync(day))
      .then((result) => {
        if (!result) {
          onClose();
          return;
        }
        // Over the result, not instead of it: Home never flashes in between.
        router.push({ pathname: '/day-complete/[day]', params: { day: String(day) } });
      })
      .catch((error: unknown) => {
        logger.error('could not finish the day', error);
        finishing.current = false;
        setFinishingDay(false);
      });
  };

  let stage = null;
  if (state.phase === 'intro') {
    stage = (
      <QuestIntro
        mascot={mascots.thinking}
        overline={`Day ${day} · ${TITLE}`}
        title="Quick recap"
        subtitle={
          run.isLastOfDay ? 'One last step for today.' : "Today's words, rule and story, once more."
        }
        duration={`about ${run.quest.estimatedMinutes} min`}
        tags={[`${items.length} questions`]}
        xpReward={run.quest.xpReward}
        replay={mode === 'replay'}
        ctaLabel="Start review"
        ctaHint="Starts the first question"
        onStart={() => dispatch({ type: 'start' })}
      />
    );
  } else if (state.phase === 'practice') {
    const item = currentItem(items, state);
    if (item) {
      const given = answerFor(state.answers, item.id);
      stage = (
        <ChoiceQuestion
          id={item.id}
          label={<ReviewSourceTag source={item.source} />}
          instruction={item.instruction}
          prompt={<ReviewPrompt item={item} answered={given !== null} />}
          options={item.options}
          correctOptionId={item.choice.correctOptionId}
          answer={given}
          feedback={item.feedback}
          onAnswer={answer}
          onContinue={() => dispatch({ type: 'continue' })}
        />
      );
    }
  } else if (flow.result) {
    const dayDone = mode === 'play' && flow.outcome?.dayCompletion != null;
    stage = (
      <QuestResult
        questLabel={TITLE}
        takeaway="Today's words, rule and story — revisited."
        result={flow.result}
        saveFailed={flow.saveFailed}
        onRetrySave={flow.retrySave}
        continueLabel={dayDone ? `Finish Day ${day}` : undefined}
        continueBusy={finishingDay}
        onContinue={dayDone ? finish : leave}
        celebratePerfect={false}>
        <ReviewBreakdown
          result={scoreReview(items, state.answers)}
          sources={reviewSources(items)}
        />
      </QuestResult>
    );
  }

  return (
    <View style={styles.fill}>
      <QuestTopBar
        title={TITLE}
        stepLabel={stepLabelFor(state, items)}
        groups={[items.length]}
        done={reviewStepsDone(items, state)}
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
