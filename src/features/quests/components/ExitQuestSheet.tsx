import { ConfirmSheet } from '@/components/ui';

export type ExitQuestSheetProps = {
  visible: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/** The same promise in every quest: leaving keeps your place. */
export function ExitQuestSheet({ visible, onStay, onLeave }: ExitQuestSheetProps) {
  return (
    <ConfirmSheet
      visible={visible}
      title="Leave this quest?"
      message="Your progress will be saved."
      stayLabel="Keep learning"
      leaveLabel="Leave"
      onStay={onStay}
      onLeave={onLeave}
    />
  );
}
