import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { parseInviteInput } from '../logic/invite-code';

/**
 * Joining with a code typed or pasted (the code, or the whole invite link):
 * it opens the invite's page — the team first, then the user's say-so.
 */
export function JoinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setText('');
    setError(null);
    onClose();
  };

  const submit = () => {
    const code = parseInviteInput(text);
    if (!code) {
      setError('That doesn’t look like a Milo invite code — 10 letters and numbers.');
      return;
    }
    close();
    router.push({ pathname: '/invite/[code]', params: { code } });
  };

  return (
    <Sheet visible={visible} onClose={close} closeLabel="Close">
      <View style={styles.body} testID="join-sheet">
        <View style={styles.titles}>
          <AppText variant="overline" color="wood">
            Join a team
          </AppText>
          <AppText variant="title2" accessibilityRole="header">
            Enter your invite code
          </AppText>
          <AppText variant="body" color="secondary">
            Your friend’s invite has a code like 7K2PX-9QDMA. You’ll see their team before you join.
          </AppText>
        </View>
        <TextField
          label="Invite code"
          placeholder="7K2PX-9QDMA"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={120}
          onChangeText={(value) => {
            setText(value);
            if (error) setError(null);
          }}
          onSubmitEditing={submit}
          returnKeyType="go"
          error={error}
          testID="join-code"
        />
        <Button
          label="Continue"
          onPress={submit}
          disabled={text.trim() === ''}
          fullWidth
          testID="join-continue"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[5] },
  titles: { gap: spacing[1] },
});
