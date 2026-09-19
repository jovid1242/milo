import { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * Leaving a quest: straight out when nothing would be lost, otherwise a calm
 * "Leave this quest?" first. Android's back button asks the same question.
 * Render `<ExitQuestSheet {...sheet} />` next to the quest.
 */
export function useExitQuest({ confirm, onExit }: { confirm: boolean; onExit: () => void }) {
  const [confirming, setConfirming] = useState(false);

  const requestExit = () => {
    if (confirm) setConfirming(true);
    else onExit();
  };

  // The quest is a full-screen modal: it is focused for as long as it is mounted.
  const onHardwareBack = useEffectEvent(() => requestExit());
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onHardwareBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return {
    requestExit,
    sheet: {
      visible: confirming,
      onStay: () => setConfirming(false),
      onLeave: () => {
        setConfirming(false);
        onExit();
      },
    },
  };
}
