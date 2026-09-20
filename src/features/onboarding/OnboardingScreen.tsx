import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Wrench } from 'lucide-react-native';
import { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  IconButton,
  LoadingState,
  Screen,
  SegmentedProgress,
} from '@/components/ui';
import { logger } from '@/lib/logger';
import { playFeedback } from '@/services/feedback';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { spacing } from '@/theme';

import { DailyQuests } from './components/DailyQuests';
import { GoalStep } from './components/GoalStep';
import { JourneyPreview } from './components/JourneyPreview';
import { MeetMilo } from './components/MeetMilo';
import { NameStep } from './components/NameStep';
import {
  TOTAL_STEPS,
  canContinue,
  continueLabel,
  nextStep,
  previousStep,
  stepAt,
  stepNumber,
} from './logic/onboarding';
import { useStartChallenge } from './queries';

/**
 * First launch. Five short steps — Milo, the ninety days, a day of it, the
 * user's goal, their name — and then the challenge begins. There is no
 * account, nothing to sign up for and nothing to skip: every step asks for
 * little and the last one starts Day 1.
 *
 * The answers live in a persisted draft, so closing the app halfway through
 * comes back to the same step with the same answers.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { devStep } = useLocalSearchParams<{ devStep?: string }>();
  const step = useOnboardingStore((state) => state.step);
  const name = useOnboardingStore((state) => state.name);
  const goal = useOnboardingStore((state) => state.goal);
  const hasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const setStep = useOnboardingStore((state) => state.setStep);
  const setName = useOnboardingStore((state) => state.setName);
  const setGoal = useOnboardingStore((state) => state.setGoal);
  const start = useStartChallenge();
  const [keyboardUp, setKeyboardUp] = useState(false);
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  // The footer rides the keyboard: "Start Day 1" must stay reachable while the
  // name is being typed. The screen already sits inside the bottom safe area,
  // which the keyboard covers too — hence the subtraction.
  const liftStyle = useAnimatedStyle(() => ({
    marginBottom: Math.max(0, keyboard.height.get() - insets.bottom),
  }));

  // Dev tools open a single step directly. The draft rehydrates asynchronously
  // and would overwrite the jump, so this waits for it.
  const openDevStep = useEffectEvent(() => {
    if (__DEV__ && devStep) setStep(stepAt(Number(devStep)));
  });
  useEffect(() => {
    if (hasHydrated) openDevStep();
  }, [hasHydrated, devStep]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const back = () => {
    const previous = previousStep(step);
    if (!previous) return;
    Keyboard.dismiss();
    setStep(previous);
  };

  // Android's back gesture walks the steps; it never leaves onboarding.
  const onHardwareBack = useEffectEvent(() => back());
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onHardwareBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const advance = () => {
    const next = nextStep(step);
    if (next) {
      setStep(next);
      return;
    }
    if (goal === null || start.isPending) return;
    Keyboard.dismiss();
    // Day 1 begins: a deliberate action, and the only sound in the whole flow.
    playFeedback('importantAction');
    start.mutate(
      { displayName: name, goal },
      {
        onError: (error: unknown) => logger.error('starting the challenge failed', error),
      },
    );
  };

  if (!hasHydrated) {
    return (
      <Screen edges={['top', 'bottom']} testID="onboarding-screen">
        <LoadingState />
      </Screen>
    );
  }

  const ready = canContinue({ step, name, goal });

  return (
    <Screen edges={['top', 'bottom']} testID="onboarding-screen">
      <Animated.View style={[styles.fill, liftStyle]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {previousStep(step) ? (
              <IconButton
                icon={ChevronLeft}
                variant="soft"
                accessibilityLabel="Back"
                onPress={back}
                testID="onboarding-back"
              />
            ) : null}
          </View>
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${stepNumber(step)} of ${TOTAL_STEPS}`}>
            <SegmentedProgress groups={[TOTAL_STEPS]} done={stepNumber(step)} />
          </View>
          <View style={styles.headerSide}>
            {__DEV__ ? (
              <IconButton
                icon={Wrench}
                variant="soft"
                accessibilityLabel="Developer tools"
                onPress={() => router.push('/dev-tools')}
              />
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View key={step} style={styles.fill}>
            {step === 'welcome' ? <MeetMilo /> : null}
            {step === 'journey' ? <JourneyPreview /> : null}
            {step === 'day' ? <DailyQuests /> : null}
            {step === 'goal' ? <GoalStep goal={goal} onSelect={setGoal} /> : null}
            {step === 'name' ? (
              <NameStep
                name={name}
                onChange={setName}
                onSubmit={() => {
                  if (ready) advance();
                }}
                compact={keyboardUp}
              />
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {start.isError ? (
            <AppText variant="caption" color="danger" align="center">
              Milo could not start the challenge. Try again.
            </AppText>
          ) : null}
          <Button
            label={continueLabel(step)}
            size="lg"
            onPress={advance}
            disabled={!ready}
            loading={start.isPending}
            fullWidth
            testID="onboarding-continue"
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerSide: { width: 44 },
  progress: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing[4] },
  footer: { gap: spacing[2], paddingTop: spacing[3], paddingBottom: spacing[2] },
});
