import { router } from 'expo-router';

/** The tabs (`app/(tabs)/index.tsx` is Today, `app/(tabs)/friends.tsx` Friends…). */
export type TabHref = '/' | '/journey' | '/friends' | '/profile';

/** The part of Expo Router's `router` this needs. */
export type TabNavigation = Pick<typeof router, 'canDismiss' | 'dismissTo' | 'navigate'>;

/**
 * Opens a tab from wherever the user is — what a tapped notification needs,
 * since it can arrive over any screen.
 *
 * - A screen open above the tabs (a quest, Settings, a modal): `dismissTo`
 *   pops the root stack back to `(tabs)` with the tab as its nested screen,
 *   closing what was open above them.
 * - Already in the tabs: there is nothing to dismiss, and the tab navigator
 *   does not handle the POP_TO action `dismissTo` sends (only native tabs turn
 *   it into a tab switch) — so the tab is switched with `navigate`.
 */
export function openTab(destination: TabHref, navigation: TabNavigation = router): void {
  if (navigation.canDismiss()) navigation.dismissTo(destination);
  else navigation.navigate(destination);
}
