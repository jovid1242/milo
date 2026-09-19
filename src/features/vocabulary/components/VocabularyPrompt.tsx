import { AppText } from '@/components/ui';
import { GapSentence } from '@/features/quests/components/GapSentence';
import type { TypographyVariant } from '@/theme';

import type { ExerciseView, VocabularyPromptKind } from '../logic/exercise-view';

const VARIANTS: Record<VocabularyPromptKind, TypographyVariant> = {
  word: 'display',
  // Russian: Inter has Cyrillic, the display serif does not.
  translation: 'headline',
  definition: 'title1',
};

/** The prompt of a vocabulary exercise — shared by the Vocabulary and Review quests. */
export function VocabularyPrompt({ view, answered }: { view: ExerciseView; answered: boolean }) {
  if (view.sentence) {
    return (
      <GapSentence
        before={view.sentence.before}
        after={view.sentence.after}
        fill={answered ? view.answerLabel : null}
      />
    );
  }
  if (!view.prompt) return null;
  return (
    <AppText variant={VARIANTS[view.prompt.kind]} accessibilityRole="header">
      {view.prompt.kind === 'definition' ? `“${view.prompt.text}”` : view.prompt.text}
    </AppText>
  );
}
