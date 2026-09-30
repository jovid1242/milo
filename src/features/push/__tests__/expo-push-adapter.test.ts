import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { configureForegroundPresentation } from '@/services/notifications/expo-notification-adapter';
import { createExpoPushAdapter } from '@/services/notifications/expo-push-adapter';

/**
 * The adapter over `expo-notifications`, with the module played by a mock:
 * no token is ever asked of Expo, no notification is ever shown.
 */

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn(() => false) }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'milo-project' } } }, easConfig: null },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
  PermissionStatus: { UNDETERMINED: 'undetermined' },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    CALENDAR: 'calendar',
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ type: 'expo', data: 'ExponentPushToken[from-expo-0000000001]' }),
  ),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const notifications = jest.mocked(Notifications);
const TEAM = '11111111-1111-4111-8111-111111111111';
const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const response = (id: string, data: Record<string, unknown>, action = DEFAULT_ACTION) =>
  ({
    actionIdentifier: action,
    notification: { request: { identifier: id, content: { data } } },
  }) as unknown as Notifications.NotificationResponse;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('on Android', () => {
  it('creates the team-updates channel — apart from the daily reminder’s', async () => {
    const adapter = createExpoPushAdapter();
    expect(adapter.supported).toBe(true);
    await adapter.ensureChannel();
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'team-updates',
      expect.objectContaining({ name: 'Team updates', importance: 3 }),
    );
  });

  it('asks Expo for this device’s token, for Milo’s EAS project', async () => {
    const adapter = createExpoPushAdapter();
    await expect(adapter.getToken()).resolves.toBe('ExponentPushToken[from-expo-0000000001]');
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'milo-project' });
  });

  it('reports a tap with its id and payload — the default action only', () => {
    const adapter = createExpoPushAdapter();
    const listener = jest.fn();
    adapter.onTap(listener);
    const report = notifications.addNotificationResponseReceivedListener.mock.calls[0]?.[0];
    const data = { kind: 'TEAM_DAY_COMPLETE', teamId: TEAM, dayNumber: 3 };
    report?.(response('n-1', data));
    report?.(response('n-2', data, 'dismiss'));
    expect(listener.mock.calls).toEqual([[{ id: 'n-1', data }]]);
  });

  it('finds the payload in the remote message when the system showed the notification', () => {
    const adapter = createExpoPushAdapter();
    const listener = jest.fn();
    adapter.onTap(listener);
    const report = notifications.addNotificationResponseReceivedListener.mock.calls[0]?.[0];
    const data = { kind: 'TEAM_MEMBER_JOINED', teamId: TEAM };
    report?.({
      actionIdentifier: DEFAULT_ACTION,
      notification: {
        request: {
          identifier: 'n-3',
          content: { data: {} },
          trigger: { type: 'push', remoteMessage: { data: { body: JSON.stringify(data) } } },
        },
      },
    } as unknown as Notifications.NotificationResponse);
    expect(listener.mock.calls).toEqual([[{ id: 'n-3', data }]]);
  });

  it('hands over the tap that launched the app, and forgets it when told', () => {
    notifications.getLastNotificationResponse.mockReturnValue(
      response('n-7', { kind: 'TEAM_YOUR_TURN', teamId: TEAM }),
    );
    const adapter = createExpoPushAdapter();
    expect(adapter.launchTap()).toEqual({
      id: 'n-7',
      data: { kind: 'TEAM_YOUR_TURN', teamId: TEAM },
    });
    adapter.clearLaunchTap();
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });
});

describe('where it cannot receive team notifications', () => {
  it('is not supported on iOS (no push keys yet) or in Expo Go', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(createExpoPushAdapter().supported).toBe(false);

    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(isRunningInExpoGo).mockReturnValueOnce(true);
    const inExpoGo = createExpoPushAdapter();
    expect(inExpoGo.supported).toBe(false);
    await expect(inExpoGo.getToken()).rejects.toThrow();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});

describe('a notification arriving while Milo is open', () => {
  it('shows team news; the daily reminder stays quiet, as before', async () => {
    configureForegroundPresentation();
    const handler = notifications.setNotificationHandler.mock.calls[0]?.[0];
    const decide = (data: Record<string, unknown>) =>
      handler?.handleNotification({
        request: { content: { data } },
      } as unknown as Notifications.Notification);

    await expect(
      decide({ kind: 'TEAM_MEMBER_COMPLETED_DAY', teamId: TEAM, dayNumber: 3 }),
    ).resolves.toMatchObject({ shouldShowBanner: true, shouldShowList: true });
    await expect(decide({ kind: 'dailyReminder', day: 3 })).resolves.toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });
});
