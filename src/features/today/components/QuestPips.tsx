import { SegmentedProgress } from '@/components/ui';

/** Today's progress as one pip per quest; a pip fills when its quest is done. */
export function QuestPips({ total, done }: { total: number; done: number }) {
  return <SegmentedProgress groups={[total]} done={done} segmentWidth={16} />;
}
