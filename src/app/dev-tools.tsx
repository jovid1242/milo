import { Redirect } from 'expo-router';

import { DevToolsScreen } from '@/features/dev-tools/DevToolsScreen';

/** Development-only route: in a production build it never renders. */
export default function DevToolsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevToolsScreen />;
}
