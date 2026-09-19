import { Check } from 'lucide-react-native';

import { Badge } from '@/components/ui';

import type { MemberTodayStatus } from '../logic/team';
import { STATUS_LABELS } from '../logic/team-copy';

const TONES: Record<MemberTodayStatus, 'brand' | 'reward' | 'neutral'> = {
  done: 'brand',
  almostThere: 'reward',
  inProgress: 'neutral',
  notStarted: 'neutral',
  unknown: 'neutral',
};

/** Today's status in words (and a check when done) — never colour alone. */
export function StatusPill({ status }: { status: MemberTodayStatus }) {
  return (
    <Badge
      label={STATUS_LABELS[status]}
      tone={TONES[status]}
      icon={status === 'done' ? Check : undefined}
    />
  );
}
