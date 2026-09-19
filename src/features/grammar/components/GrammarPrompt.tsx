import { AppText } from '@/components/ui';
import { GapSentence } from '@/features/quests/components/GapSentence';

import type { GrammarExerciseView } from '../logic/exercise-view';

/** The prompt of a grammar exercise — shared by the Grammar and Review quests. */
export function GrammarPrompt({
  view,
  answered,
}: {
  view: GrammarExerciseView;
  answered: boolean;
}) {
  if (view.gap) {
    return (
      <GapSentence
        before={view.gap.before}
        after={view.gap.after}
        fill={answered ? view.answerLabel : null}
      />
    );
  }
  return (
    <AppText variant="title1" accessibilityRole="header">
      {view.question}
    </AppText>
  );
}
