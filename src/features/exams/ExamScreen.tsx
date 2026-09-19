import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, ConfirmSheet, LoadingState } from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { useRepositories } from '@/data/repository-provider';
import { useFinishDay } from '@/features/day-complete/queries';
import { invalidateProgress } from '@/features/progress/queries';
import { markQuestCelebrated } from '@/features/quests/celebrations';
import { useExitQuest } from '@/features/quests/hooks/use-exit-quest';
import { createWriteQueue } from '@/features/quests/hooks/use-quest-flow';
import { FinalPassed } from '@/features/summit/components/FinalPassed';
import { SummitIntro } from '@/features/summit/components/SummitIntro';
import { logger } from '@/lib/logger';
import type { Exam, ExamAttempt, ExamScore } from '@/schemas';
import { playFeedback, type FeedbackEvent } from '@/services/feedback';
import { spacing } from '@/theme';

import { ExamIntro } from './components/ExamIntro';
import { ExamNotReady } from './components/ExamNotReady';
import { ExamQuestion } from './components/ExamQuestion';
import { ExamResult, type ExamAction, type ExamResultCopy } from './components/ExamResult';
import { ExamReview } from './components/ExamReview';
import { ExamTopBar, type ExamProgress } from './components/ExamTopBar';
import {
  answerFor,
  scoreExam,
  unansweredQuestions,
  withExamAnswer,
  withPosition,
} from './logic/exam';
import { useExamRun } from './queries';
import {
  saveExamAttempt,
  startExamAttempt,
  submitExam,
  type ExamRun,
  type ExamSubmission,
} from './use-cases';

/** Weekly exams sit on every 7th day, up to Day 84. */
const LAST_EXAM_DAY =
  Math.floor((CHALLENGE.totalDays - 1) / CHALLENGE.weeklyExamInterval) *
  CHALLENGE.weeklyExamInterval;

/** What differs between a weekly exam and the Final Battle — the rules stay the same. */
type Flavor = {
  title: string;
  copy: ExamResultCopy;
  finishLabel: string;
  leaveTitle: string;
  /** Played on a real start only — never when an open attempt is picked up. */
  startEvent: FeedbackEvent;
  /** `null` for the Final Battle: the summit's victory is its one moment. */
  passEvent: FeedbackEvent | null;
};

function flavorOf(exam: Exam): Flavor {
  if (exam.type === 'finalBattle') {
    return {
      title: 'Final Battle',
      copy: { name: 'Final Battle', passed: 'Final Battle passed', notPassed: 'You’re close.' },
      finishLabel: 'Finish Final Battle',
      leaveTitle: 'Leave the Final Battle?',
      startEvent: 'finalBattle',
      passEvent: null,
    };
  }
  const title = `Week ${exam.week} exam`;
  return {
    title,
    copy: { name: title, passed: 'Weekly exam passed', notPassed: 'Almost there' },
    finishLabel: 'Finish exam',
    leaveTitle: 'Leave exam?',
    startEvent: 'weeklyExamStart',
    passEvent: 'weeklyExamPass',
  };
}

/**
 * An exam — the weekly checkpoint or Day 90's Final Battle: a focused
 * assessment, not a fifth quest. Answers are only chosen, never judged, until
 * the whole exam is handed in; then the result, a review of the mistakes and,
 * whenever wanted, another try. The Final Battle opens with the summit's own
 * intro and, once passed, leads on to the Summit Victory.
 */
export function ExamScreen({ questId }: { questId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useExamRun(questId);
  // Development shortcut: `?devStage=question|review` skips the intro / the result.
  const { devStage } = useLocalSearchParams<{ devStage?: string }>();
  // Decided once, from fresh data: later refetches never swap the screen.
  const [run, setRun] = useState<ExamRun | null>(null);
  if (query.data !== undefined && !query.isFetching && run === null) setRun(query.data);

  const close = () => {
    invalidateProgress(queryClient);
    router.back();
  };

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!run) return <LoadingState />;

  const notReady = notReadyCopy(run);
  if (!run.exam || notReady) {
    return (
      <>
        <ExamTopBar title={run.quest.title} onClose={close} />
        <ExamNotReady
          title={notReady?.title ?? `${run.quest.title} is on its way`}
          message={notReady?.message ?? 'This exam is not ready yet. Please check back soon.'}
          onClose={close}
        />
      </>
    );
  }
  return (
    <ExamSession
      run={run}
      exam={run.exam}
      devStage={__DEV__ && (devStage === 'question' || devStage === 'review') ? devStage : null}
      onClose={close}
    />
  );
}

function notReadyCopy(run: ExamRun): { title: string; message: string } | null {
  const day = run.quest.day;
  const summit = run.quest.type === 'finalBattle';
  if (run.status === 'locked') {
    if (run.currentDay < day) {
      return {
        title: `Opens on Day ${day}`,
        message: summit
          ? 'The Final Battle waits at the top — the day after Day 89.'
          : 'Each weekly exam opens on its day, after that day’s warm-up.',
      };
    }
    return {
      title: 'Warm up first',
      message: 'Finish today’s other quests — then the exam opens.',
    };
  }
  if (run.status === 'missed') {
    const next =
      Math.ceil(run.currentDay / CHALLENGE.weeklyExamInterval) * CHALLENGE.weeklyExamInterval;
    return {
      title: 'This exam’s day has passed',
      message:
        next <= LAST_EXAM_DAY
          ? `Each weekly exam belongs to its day. The next one is on Day ${next}.`
          : 'Each weekly exam belongs to its day. The summit is next.',
    };
  }
  return null;
}

/** A handed-in attempt, as the result and the review show it. */
type Submitted = {
  attempt: ExamAttempt;
  result: ExamScore;
  /** XP this submission paid — counted up once. */
  xpEarned: number;
  /** Reopened (or submitted twice): the moment already happened. */
  settled: boolean;
  /** The submission finished the exam's day: its summary comes next. */
  dayCompleted: boolean;
};

type Stage =
  /** The Final Battle's first open: Day 90's cinematic intro. */
  | { kind: 'summit' }
  | { kind: 'intro' }
  | { kind: 'question' }
  /** The Final Battle just passed: the result resolves, then the summit. */
  | { kind: 'passed'; submitted: Submitted }
  | { kind: 'result'; submitted: Submitted }
  | { kind: 'review'; submitted: Submitted };

type DevStage = 'question' | 'review' | null;

type Busy = 'start' | 'submit' | 'finishDay' | null;

function fromSubmission(submission: ExamSubmission): Submitted {
  return {
    attempt: submission.attempt,
    result: submission.result,
    xpEarned: submission.xpEarned,
    settled: !submission.isFirstSubmission,
    dayCompleted: submission.dayCompleted,
  };
}

/**
 * Resume an open attempt from the intro; otherwise the best result — or, for
 * a first start, the intro (the Final Battle's begins with the summit).
 */
function initialStage(run: ExamRun, exam: Exam, devStage: DevStage): Stage {
  if (run.open) return { kind: devStage === 'question' ? 'question' : 'intro' };
  if (!run.best) return { kind: exam.type === 'finalBattle' ? 'summit' : 'intro' };
  const result = scoreExam(exam, run.best.answers);
  const submitted: Submitted = {
    attempt: run.best,
    result,
    // The exam's reward, shown as earned — it counted up when it was paid.
    xpEarned: result.passed && run.rewardPaid ? exam.xpReward : 0,
    settled: true,
    dayCompleted: false,
  };
  return { kind: devStage === 'review' ? 'review' : 'result', submitted };
}

function ExamSession({
  run,
  exam,
  devStage,
  onClose,
}: {
  run: ExamRun;
  exam: Exam;
  devStage: DevStage;
  onClose: () => void;
}) {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const router = useRouter();
  const finishDay = useFinishDay();
  const [queue] = useState(createWriteQueue);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(run.open);
  const [stage, setStage] = useState<Stage>(() => initialStage(run, exam, devStage));
  const [busy, setBusy] = useState<Busy>(null);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  // Per passage: shown or folded, once the user chose.
  const [passages, setPassages] = useState<Readonly<Record<string, boolean>>>({});
  // One start, submit or next screen at a time — however fast the taps.
  const acting = useRef(false);
  const flavor = flavorOf(exam);

  // Position and answers are saved on every change: leaving, or the app
  // closing, resumes right here.
  const save = useEffectEvent((current: ExamAttempt) => {
    void queue.run(() => saveExamAttempt(repositories, current));
  });
  useEffect(() => {
    if (attempt && attempt.submittedAt === null) save(attempt);
  }, [attempt]);

  const leave = () => void queue.idle().then(onClose);
  const exit = useExitQuest({
    confirm: stage.kind === 'question',
    onExit: () => {
      if (stage.kind === 'review') setStage({ kind: 'result', submitted: stage.submitted });
      else leave();
    },
  });

  const start = () => {
    if (attempt) {
      setStage({ kind: 'question' });
      return;
    }
    if (acting.current) return;
    acting.current = true;
    setBusy('start');
    startExamAttempt(repositories, exam.questId)
      .then((opened) => {
        // The start sound belongs to a real start, not to picking up an open attempt.
        playFeedback(opened.answers.length === 0 ? flavor.startEvent : 'importantAction');
        setAttempt(opened);
        setPassages({});
        setStage({ kind: 'question' });
        invalidateProgress(queryClient);
      })
      .catch((error: unknown) => logger.error('could not start the exam', error))
      .finally(() => {
        acting.current = false;
        setBusy(null);
      });
  };

  const select = (optionId: string) => {
    const question = attempt ? exam.questions[attempt.currentIndex] : undefined;
    if (!attempt || !question || answerFor(attempt.answers, question.id) === optionId) return;
    const next = withExamAnswer(attempt, question, optionId, new Date().toISOString());
    if (next === attempt) return;
    playFeedback('answerSelect');
    setAttempt(next);
  };

  const moveTo = (index: number) => {
    if (attempt) setAttempt(withPosition(attempt, index, exam, new Date().toISOString()));
  };

  const submit = () => {
    if (!attempt || acting.current) return;
    acting.current = true;
    setConfirmingSubmit(false);
    setSubmitFailed(false);
    setBusy('submit');
    playFeedback('examSubmit');
    const current = attempt;
    // The last change is stored first: the stored attempt is what gets scored.
    void queue.run(() => saveExamAttempt(repositories, current));
    queue
      .run(() => submitExam(repositories, current.id))
      .then((submission) => {
        const submitted = fromSubmission(submission);
        if (submission.isFirstSubmission) {
          // Home animates the finished step without replaying a sound.
          markQuestCelebrated(exam.questId);
          // One sound for the moment; the Final Battle leaves it to the summit.
          if (flavor.passEvent && submission.result.passed) {
            playFeedback(submission.result.isPerfect ? 'perfect' : flavor.passEvent);
          }
        }
        setAttempt(null);
        setStage(
          submission.challengeCompleted
            ? { kind: 'passed', submitted }
            : { kind: 'result', submitted },
        );
        invalidateProgress(queryClient);
      })
      .catch((error: unknown) => {
        logger.error('could not submit the exam', error);
        setSubmitFailed(true);
      })
      .finally(() => {
        acting.current = false;
        setBusy(null);
      });
  };

  const finish = () => {
    if (!attempt) return;
    if (unansweredQuestions(exam, attempt.answers).length > 0) setConfirmingSubmit(true);
    else submit();
  };

  // The guard stays set once the next screen opens, so it can never open twice.
  const openOnce = (open: () => void) => {
    if (acting.current) return;
    acting.current = true;
    void queue.idle().then(open);
  };

  const toSummit = (replay: boolean) =>
    openOnce(() =>
      // Over the result, not instead of it: Home never flashes in between.
      router.push(replay ? { pathname: '/summit', params: { replay: '1' } } : '/summit'),
    );

  // Finishing the day is idempotent (the submission recorded it already).
  const finishTheDay = () => {
    if (acting.current) return;
    acting.current = true;
    setBusy('finishDay');
    queue
      .idle()
      .then(() => finishDay.mutateAsync(exam.day))
      .then((result) => {
        if (!result) {
          onClose();
          return;
        }
        router.push({ pathname: '/day-complete/[day]', params: { day: String(exam.day) } });
      })
      .catch((error: unknown) => {
        logger.error('could not finish the day', error);
        acting.current = false;
        setBusy(null);
      });
  };

  let body: ReactNode = null;
  let progress: ExamProgress | undefined;

  if (stage.kind === 'summit') {
    body = (
      <SummitIntro
        day={exam.day}
        questions={exam.questions.length}
        minutes={exam.estimatedMinutes}
        xpReward={run.rewardPaid ? 0 : exam.xpReward}
        onClimb={() => setStage({ kind: 'intro' })}
        onClose={leave}
      />
    );
  } else if (stage.kind === 'intro') {
    body = (
      <ExamIntro
        exam={exam}
        open={attempt}
        rewardPaid={run.rewardPaid}
        busy={busy === 'start'}
        onStart={start}
      />
    );
  } else if (stage.kind === 'question' && attempt) {
    const index = attempt.currentIndex;
    const question = exam.questions[index];
    const total = exam.questions.length;
    const isLast = index === total - 1;
    const unanswered = unansweredQuestions(exam, attempt.answers).length;
    progress = {
      index,
      questions: exam.questions.map((item) => ({
        id: item.id,
        answered: answerFor(attempt.answers, item.id) !== null,
      })),
    };
    if (question) {
      const passageId = question.passageId;
      const firstOfPassage = exam.questions.find((item) => item.passageId === passageId);
      const passageOpen = passageId
        ? (passages[passageId] ?? firstOfPassage?.id === question.id)
        : false;
      body = (
        <ExamQuestion
          exam={exam}
          question={question}
          selected={answerFor(attempt.answers, question.id)}
          passageOpen={passageOpen}
          onTogglePassage={() => {
            if (passageId) setPassages({ ...passages, [passageId]: !passageOpen });
          }}
          onSelect={select}
          footer={
            <>
              {isLast ? (
                <AppText
                  variant="caption"
                  color={unanswered > 0 ? 'secondary' : 'brand'}
                  align="center"
                  testID="exam-answered-note">
                  {unanswered > 0
                    ? `${unanswered} not answered yet`
                    : `All ${total} questions answered`}
                </AppText>
              ) : null}
              {submitFailed ? (
                <AppText variant="caption" color="danger" align="center">
                  Your answers could not be handed in yet. Please try again.
                </AppText>
              ) : null}
              <View style={styles.nav}>
                <Button
                  label="Previous"
                  variant="secondary"
                  size="md"
                  onPress={() => moveTo(index - 1)}
                  disabled={index === 0 || busy === 'submit'}
                  style={styles.navButton}
                  testID="exam-previous"
                />
                {isLast ? (
                  // The last step has the longer label ("Finish Final Battle"): room for one line.
                  <Button
                    label={flavor.finishLabel}
                    size="md"
                    onPress={finish}
                    loading={busy === 'submit'}
                    disabled={busy === 'submit'}
                    style={styles.navButtonWide}
                    testID="exam-finish"
                  />
                ) : (
                  <Button
                    label="Next"
                    size="md"
                    onPress={() => moveTo(index + 1)}
                    style={styles.navButton}
                    testID="exam-next"
                  />
                )}
              </View>
            </>
          }
        />
      );
    }
  } else if (stage.kind === 'passed') {
    body = <FinalPassed result={stage.submitted.result} onContinue={() => toSummit(false)} />;
  } else if (stage.kind === 'result' || stage.kind === 'review') {
    const { submitted } = stage;
    const { passed } = submitted.result;
    const mistakes = submitted.result.totalCount - submitted.result.correctCount;
    const actions: Record<ActionKey, ExamAction> = {
      review: {
        label: mistakes > 0 && exam.type === 'weeklyExam' ? 'Review mistakes' : 'Review answers',
        onPress: () => setStage({ kind: 'review', submitted }),
      },
      retake: {
        label: passed ? 'Take it again' : 'Try again',
        onPress: start,
        busy: busy === 'start',
      },
      finishDay: {
        label: `Finish Day ${exam.day}`,
        onPress: finishTheDay,
        busy: busy === 'finishDay',
      },
      continue: { label: 'Continue journey', onPress: leave },
      summit: { label: 'See the summit', onPress: () => toSummit(true) },
    };
    const plan = actionPlan(exam, submitted);
    const [primaryKey, secondaryKey] = stage.kind === 'result' ? plan.result : plan.review;
    const primary = actions[primaryKey];
    const secondary = secondaryKey ? actions[secondaryKey] : null;

    body =
      stage.kind === 'result' ? (
        <ExamResult
          exam={exam}
          copy={flavor.copy}
          result={submitted.result}
          answers={submitted.attempt.answers}
          xpEarned={submitted.xpEarned}
          settled={submitted.settled}
          primary={primary}
          secondary={secondary}
        />
      ) : (
        <ExamReview
          exam={exam}
          title={flavor.title}
          answers={submitted.attempt.answers}
          onBack={() => setStage({ kind: 'result', submitted })}
          primary={primary}
          secondary={secondary}
        />
      );
  }

  const unansweredCount = attempt ? unansweredQuestions(exam, attempt.answers).length : 0;

  return (
    <View style={styles.fill} testID="exam-screen">
      {stage.kind === 'review' || stage.kind === 'summit' ? null : (
        <ExamTopBar title={flavor.title} progress={progress} onClose={exit.requestExit} />
      )}
      {body}
      <ConfirmSheet
        {...exit.sheet}
        title={flavor.leaveTitle}
        message="Your progress will be saved."
        stayLabel="Keep going"
        leaveLabel="Leave"
      />
      <ConfirmSheet
        visible={confirmingSubmit}
        title={`${unansweredCount} ${unansweredCount === 1 ? 'question' : 'questions'} unanswered`}
        message="Unanswered questions count as not right. You can go back and answer them first."
        stayLabel="Go back"
        leaveLabel="Submit anyway"
        onStay={() => {
          setConfirmingSubmit(false);
          const first = attempt ? unansweredQuestions(exam, attempt.answers)[0] : undefined;
          if (first) moveTo(exam.questions.indexOf(first));
        }}
        onLeave={submit}
      />
    </View>
  );
}

type ActionKey = 'review' | 'retake' | 'finishDay' | 'continue' | 'summit';
type ActionPair = readonly [ActionKey, ActionKey | null];

/**
 * Where a result leads, as [primary, secondary] for the result and for the
 * review. A weekly exam goes on to its day; a Final Battle not passed yet to
 * its review and another try; a passed one back to the summit.
 */
function actionPlan(exam: Exam, submitted: Submitted): { result: ActionPair; review: ActionPair } {
  const { passed } = submitted.result;
  if (exam.type === 'finalBattle') {
    return passed
      ? { result: ['summit', 'review'], review: ['summit', 'retake'] }
      : { result: ['review', 'retake'], review: ['retake', 'continue'] };
  }
  const onward: ActionKey = submitted.dayCompleted ? 'finishDay' : 'continue';
  return passed
    ? { result: [onward, 'review'], review: [onward, 'retake'] }
    : {
        result: ['review', submitted.dayCompleted ? 'finishDay' : 'retake'],
        review: ['retake', onward],
      };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  nav: { flexDirection: 'row', gap: spacing[3] },
  navButton: { flex: 1 },
  navButtonWide: { flex: 2 },
});
