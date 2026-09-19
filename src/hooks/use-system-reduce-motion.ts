import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The system Reduce Motion setting, kept live — the app follows it everywhere. */
export function useSystemReduceMotion(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}
