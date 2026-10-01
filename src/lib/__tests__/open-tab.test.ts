import {
  StackRouter,
  TabRouter,
  type NavigationState,
  type ParamListBase,
  type Router,
} from 'expo-router/build/react-navigation/routers';

import { openTab, type TabHref, type TabNavigation } from '../open-tab';

/**
 * Opening a tab from a notification, wherever the user is. The routers here
 * are Expo Router's own (its React Navigation), the ones the app runs: the
 * root stack (`app/_layout.tsx`) with the JS tabs (`app/(tabs)`) at its
 * bottom and screens such as Settings or a quest above them.
 */

const TABS = ['index', 'journey', 'friends', 'profile'];
const STACK = ['(tabs)', 'settings', 'quest/[questId]'];
const tabsOf: Record<TabHref, string> = {
  '/': 'index',
  '/journey': 'journey',
  '/friends': 'friends',
  '/profile': 'profile',
};

type Action = { type: string; payload?: Record<string, unknown> };

function apply<S extends NavigationState>(
  router: Router<S, never>,
  state: S,
  names: string[],
  action: Action,
): S | null {
  return router.getStateForAction(state, action as never, {
    routeNames: names,
    routeParamList: {},
    routeGetIdList: {},
  }) as S | null;
}

/**
 * The app's navigation, driven by the same actions Expo Router dispatches:
 * an href is sent to the navigator where it differs from the current state
 * (the root stack while a screen is open above the tabs, the tab navigator
 * otherwise); a nested `screen` param makes the tabs navigate there.
 */
class App {
  readonly tabRouter = TabRouter({}) as unknown as Router<NavigationState, never>;
  readonly stackRouter = StackRouter({}) as unknown as Router<NavigationState, never>;
  tabs: NavigationState;
  stack: NavigationState;
  readonly unhandled: string[] = [];

  constructor({ tab = 'index', above = [] as string[] } = {}) {
    const options = { routeNames: TABS, routeParamList: {}, routeGetIdList: {} };
    this.tabs = this.tabRouter.getInitialState(options as never);
    this.switchTab(tab);
    this.stack = this.stackRouter.getInitialState({
      routeNames: STACK,
      routeParamList: {},
      routeGetIdList: {},
    } as never);
    for (const name of above) {
      this.stack = apply(this.stackRouter, this.stack, STACK, {
        type: 'PUSH',
        payload: { name },
      }) as NavigationState;
    }
  }

  private switchTab(name: string, type = 'NAVIGATE') {
    const next = apply(this.tabRouter, this.tabs, TABS, { type, payload: { name } });
    if (next === null) this.unhandled.push(`${type} ${name} (tabs)`);
    else this.tabs = next;
  }

  /** The screen in front: a screen above the tabs, or the focused tab. */
  get screen(): string {
    const top = this.stack.routes[this.stack.index];
    return top?.name === '(tabs)'
      ? (this.tabs.routes[this.tabs.index]?.name ?? '?')
      : (top?.name ?? '?');
  }

  /** What Expo Router dispatches for `href` with this action type. */
  dispatch(type: 'POP_TO' | 'NAVIGATE', href: TabHref) {
    const tab = tabsOf[href];
    const aboveTabs = this.stack.routes.length > 1;
    if (!aboveTabs) {
      this.switchTab(tab, type);
      return;
    }
    const next = apply(this.stackRouter, this.stack, STACK, {
      type,
      payload: { name: '(tabs)', params: { screen: tab } },
    });
    if (next === null) {
      this.unhandled.push(`${type} (tabs) (stack)`);
      return;
    }
    this.stack = next;
    const focused = next.routes[next.index] as { params?: ParamListBase };
    // The tabs navigate to the nested screen they were given (useNavigationBuilder).
    if (focused.params?.['screen']) this.switchTab(String(focused.params['screen']));
  }

  get navigation(): TabNavigation {
    return {
      canDismiss: () => this.stack.routes.length > 1,
      dismissTo: ((href: TabHref) => this.dispatch('POP_TO', href)) as TabNavigation['dismissTo'],
      navigate: ((href: TabHref) => this.dispatch('NAVIGATE', href)) as TabNavigation['navigate'],
    };
  }
}

describe('the cause: dismissTo inside the tabs', () => {
  it('sends POP_TO, which the tab navigator does not handle — the tap did nothing', () => {
    const app = new App({ tab: 'index' });
    app.navigation.dismissTo('/friends');
    expect(app.screen).toBe('index');
    expect(app.unhandled).toEqual(['POP_TO friends (tabs)']);
  });

  it('and a reminder tapped on another tab stayed there just the same', () => {
    const app = new App({ tab: 'friends' });
    app.navigation.dismissTo('/');
    expect(app.screen).toBe('friends');
    expect(app.unhandled).toEqual(['POP_TO index (tabs)']);
  });

  it('while navigate from a screen above the tabs would stack a second copy of them', () => {
    const app = new App({ tab: 'index', above: ['settings'] });
    app.navigation.navigate('/friends');
    expect(app.stack.routes.map((route) => route.name)).toEqual(['(tabs)', 'settings', '(tabs)']);
  });
});

describe('openTab', () => {
  it.each([
    { from: 'Today', tab: 'index', href: '/friends' as const, to: 'friends' },
    { from: 'Journey', tab: 'journey', href: '/friends' as const, to: 'friends' },
    { from: 'Friends', tab: 'friends', href: '/friends' as const, to: 'friends' },
    { from: 'Friends', tab: 'friends', href: '/' as const, to: 'index' },
    { from: 'Profile', tab: 'profile', href: '/' as const, to: 'index' },
  ])('in the tabs, on $from: switches to $to', ({ tab, href, to }) => {
    const app = new App({ tab });
    openTab(href, app.navigation);
    expect(app.screen).toBe(to);
    expect(app.unhandled).toEqual([]);
  });

  it.each([
    { from: 'Settings', above: ['settings'], href: '/friends' as const, to: 'friends' },
    { from: 'a quest', above: ['quest/[questId]'], href: '/' as const, to: 'index' },
    {
      from: 'a quest over Settings',
      above: ['settings', 'quest/[questId]'],
      href: '/friends' as const,
      to: 'friends',
    },
  ])('from $from above the tabs: closes it, back on $to', ({ above, href, to }) => {
    const app = new App({ tab: 'journey', above });
    openTab(href, app.navigation);
    expect(app.stack.routes.map((route) => route.name)).toEqual(['(tabs)']);
    expect(app.screen).toBe(to);
    expect(app.unhandled).toEqual([]);
  });

  it('asks the router which case it is in, and never both', () => {
    const calls: string[] = [];
    const record = (name: string) => ((href: string) => calls.push(`${name} ${href}`)) as never;
    openTab('/friends', {
      canDismiss: () => false,
      dismissTo: record('dismissTo'),
      navigate: record('navigate'),
    });
    openTab('/', {
      canDismiss: () => true,
      dismissTo: record('dismissTo'),
      navigate: record('navigate'),
    });
    expect(calls).toEqual(['navigate /friends', 'dismissTo /']);
  });
});
