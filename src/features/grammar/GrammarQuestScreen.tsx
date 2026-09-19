import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, LoadingState } from '@/components/ui';
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
import type { GrammarProgress, GrammarQuest, GrammarRule } from '@/schemas';
import { spacing } from '@/theme';

import { GrammarPrompt } from './components/GrammarPrompt';
import { GuidedExample } from './components/GuidedExample';
import { LearnRule } from './components/LearnRule';
import { RuleLearned } from './components/RuleLearned';
import { describeGrammarExercise } from './logic/exercise-view';
import {
  INITIAL_GRAMMAR,
  currentExample,
  currentExercise,
  grammarProgress,
  grammarStage,
  grammarSteps,
  grammarStepsDone,
  hasGrammarProgress,
  pointById,
  reduceGrammar,
  restoreGrammar,
  type GrammarAction,
} from './logic/grammar-session';

const TITLE = 'Grammar';

/**
 * The Grammar quest. Opens where the user left off, or on the summary of a
 * finished quest (with an XP-free replay).
 */
export function GrammarQuestScreen({ questId }: { questId: string }) {
  const { query, mode, setMode, close } = useQuestScreen(questId);
  const run = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!run || mode === null) return <LoadingState />;

  const content = run.content?.type === 'grammar' ? run.content : null;
  if (!content) {
    return (
      <>
        <QuestTopBar title={TITLE} stepLabel="" groups={[]} done={0} onClose={close} />
        <QuestUnavailable day={run.quest.day} onClose={close} />
      </>
    );
  }

  if (mode === 'completed' && run.completion) {
    const steps = grammarSteps(content);
    return (
      <>
        <QuestTopBar
          title={TITLE}
          stepLabel="Done"
          groups={[steps.learn, steps.practice]}
          done={steps.learn + steps.practice}
          onClose={close}
        />
        <QuestCompleted
          completion={run.completion}
          onPracticeAgain={() => setMode('replay')}
          onClose={close}>
          <RuleLearned rule={content.rule} />
        </QuestCompleted>
      </>
    );
  }

  return (
    <GrammarRun
      key={mode}
      run={run}
      content={content}
      mode={mode === 'replay' ? 'replay' : 'play'}
      onClose={close}
    />
  );
}

function stepLabelFor(state: GrammarProgress, content: GrammarQuest): string {
  switch (state.phase) {
    case 'intro':
      return 'One rule';
    case 'rule':
      return 'The rule';
    case 'examples':
      return `Example ${state.exampleIndex + 1} of ${content.examples.length}`;
    case 'practice':
      return `${state.practiceIndex + 1} of ${content.exercises.length}`;
    case 'result':
      return 'Done';
  }
}

/** "Present Perfect vs Past Simple" stacked, with a quiet "vs" between the two. */
function RuleTitle({ rule }: { rule: GrammarRule }) {
  const sides = rule.title.split(' vs ');
  if (sides.length !== 2) {
    return (
      <AppText variant="display" align="center" accessibilityRole="header">
        {rule.title}
      </AppText>
    );
  }
  return (
    <View
      style={styles.ruleTitle}
      accessible
      accessibilityRole="header"
      accessibilityLabel={rule.title}>
      <AppText variant="display" align="center">
        {sides[0]}
      </AppText>
      <AppText variant="title3" color="wood" align="center">
        vs
      </AppText>
      <AppText variant="display" align="center">
        {sides[1]}
      </AppText>
    </View>
  );
}

function GrammarRun({
  run,
  content: initialContent,
  mode,
  onClose,
}: {
  run: QuestRun;
  content: GrammarQuest;
  mode: RunMode;
  onClose: () => void;
}) {
  // The quest is fixed for this run, whatever refetches bring.
  const [content] = useState(initialContent);
  const [initial] = useState(() =>
    mode === 'replay' ? INITIAL_GRAMMAR : restoreGrammar(content, run.savedState),
  );
  const flow = useQuestFlow(
    (state: GrammarProgress, action: GrammarAction) => reduceGrammar(content, state, action),
    initial,
    {
      questId: content.questId,
      mode,
      savedStartedAt: mode === 'replay' ? null : run.startedAt,
      exerciseCount: content.exercises.length,
      stageOf: grammarStage,
      progressOf: (state) => grammarProgress(content, state),
      answersOf: (state) => state.answers,
    },
  );
  const { state, dispatch } = flow;
  const steps = grammarSteps(content);

  const leave = () => void flow.flush().then(onClose);
  const exit = useExitQuest({
    confirm: mode === 'play' && flow.stage === 'playing' && hasGrammarProgress(content, state),
    onExit: leave,
  });

  const answer = (optionId: string) => {
    const exercise = currentExercise(content, state);
    if (!exercise || answerFor(state.answers, exercise.id)) return;
    playAnswerFeedback(optionId === exercise.correctOptionId);
    dispatch({ type: 'answer', optionId, at: new Date().toISOString() });
  };

  let stage = null;
  if (state.phase === 'intro') {
    stage = (
      <QuestIntro
        mascot={mascots.grammar}
        overline={`Day ${run.quest.day} · ${TITLE}`}
        title={<RuleTitle rule={content.rule} />}
        subtitle={run.quest.summary}
        duration={`about ${run.quest.estimatedMinutes} min`}
        xpReward={run.quest.xpReward}
        replay={mode === 'replay'}
        ctaLabel="Learn the rule"
        ctaHint="Shows the rule, then a few examples"
        onStart={() => dispatch({ type: 'start' })}
      />
    );
  } else if (state.phase === 'rule') {
    stage = <LearnRule rule={content.rule} onLearned={() => dispatch({ type: 'ruleLearned' })} />;
  } else if (state.phase === 'examples') {
    const example = currentExample(content, state);
    if (example) {
      stage = (
        <GuidedExample
          example={example}
          point={pointById(content, example.pointId)}
          revealed={state.exampleRevealed}
          isLast={state.exampleIndex === content.examples.length - 1}
          onReveal={() => dispatch({ type: 'revealExample' })}
          onNext={() => dispatch({ type: 'nextExample' })}
        />
      );
    }
  } else if (state.phase === 'practice') {
    const exercise = currentExercise(content, state);
    if (exercise) {
      const view = describeGrammarExercise(exercise);
      const given = answerFor(state.answers, exercise.id);
      stage = (
        <ChoiceQuestion
          id={exercise.id}
          instruction={view.instruction}
          prompt={<GrammarPrompt view={view} answered={given !== null} />}
          options={view.options}
          correctOptionId={exercise.correctOptionId}
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
        takeaway="One new rule for the journey."
        result={flow.result}
        saveFailed={flow.saveFailed}
        onRetrySave={flow.retrySave}
        onContinue={leave}>
        <RuleLearned rule={content.rule} />
      </QuestResult>
    );
  }

  return (
    <View style={styles.fill}>
      <QuestTopBar
        title={TITLE}
        stepLabel={stepLabelFor(state, content)}
        groups={[steps.learn, steps.practice]}
        done={grammarStepsDone(content, state)}
        onClose={exit.requestExit}
      />
      {stage}
      <ExitQuestSheet {...exit.sheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ruleTitle: { alignItems: 'center', gap: spacing[0] },
});
