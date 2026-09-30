import { CircleAlert, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { TEAM_PROBLEMS, type TeamProblem } from '../logic/team-errors';

/**
 * Why a team action did not happen, in a calm inline note — "Internet
 * connection required" for everything that needs the server.
 */
export function TeamNotice({ problem, testID }: { problem: TeamProblem; testID?: string }) {
  const { title, message } = TEAM_PROBLEMS[problem];
  const Icon = problem === 'offline' ? WifiOff : CircleAlert;
  return (
    <View
      style={styles.notice}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      testID={testID ?? `team-notice-${problem}`}>
      <Icon size={18} color={colors.text.secondary} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color="secondary">
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface.warm,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  text: { flex: 1, gap: 2 },
});
