import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet } from '@/components/ui';
import type { ReadingWord } from '@/schemas';
import { spacing } from '@/theme';

export type WordSheetProps = {
  /** `null` closes the sheet. */
  word: ReadingWord | null;
  onClose: () => void;
};

/** A small card for a word from the story: sound, meaning, translation. No new screen. */
export function WordSheet({ word, onClose }: WordSheetProps) {
  // Keeps showing the last word while the sheet slides away.
  const [shown, setShown] = useState(word);
  if (word && word !== shown) setShown(word);

  return (
    <Sheet visible={word !== null} onClose={onClose} closeLabel="Back to the story">
      {shown ? (
        <View
          style={styles.body}
          accessible
          accessibilityLabel={`${shown.text}: ${shown.translation}. ${shown.definition}`}>
          <View style={styles.head}>
            <AppText variant="display">{shown.text}</AppText>
            {shown.phonetic ? (
              <AppText variant="bodyLarge" color="secondary">
                {shown.phonetic}
              </AppText>
            ) : null}
          </View>
          <AppText variant="headline" color="brand">
            {shown.translation}
          </AppText>
          <AppText variant="bodyLarge" color="secondary">
            {shown.definition}
          </AppText>
        </View>
      ) : null}
      <Button label="Back to the story" variant="secondary" size="md" fullWidth onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[2] },
  head: { gap: 2, marginBottom: spacing[1] },
});
