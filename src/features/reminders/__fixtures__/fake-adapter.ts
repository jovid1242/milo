import type {
  NotificationAdapter,
  NotificationPermission,
  NotificationRequest,
  SystemNotification,
} from '@/services/notifications/notification-adapter';

type Operation = 'getPermission' | 'schedule' | 'cancel' | 'getScheduled' | 'dismiss';

const toSystem = ({ id, title, body, data }: NotificationRequest): SystemNotification => ({
  id,
  title,
  body,
  data,
});

/**
 * The phone's notification system, in memory: what is pending, what was
 * delivered, what the permission is and what the system dialog would answer.
 * Any operation can be made to fail.
 */
export class FakeNotificationAdapter implements NotificationAdapter {
  permission: NotificationPermission = { status: 'granted' };
  /** What the system dialog answers when asked. */
  answer: NotificationPermission = { status: 'granted' };
  readonly pending = new Map<string, NotificationRequest>();
  readonly delivered = new Map<string, SystemNotification>();
  readonly failing = new Set<Operation>();
  readonly calls = { schedule: 0, cancel: 0, request: 0, dismiss: 0 };

  private check(operation: Operation) {
    if (this.failing.has(operation)) throw new Error(`${operation} failed`);
  }

  async getPermission() {
    this.check('getPermission');
    return this.permission;
  }
  async requestPermission() {
    this.calls.request += 1;
    this.permission = this.answer;
    return this.permission;
  }
  async schedule(request: NotificationRequest) {
    this.check('schedule');
    this.calls.schedule += 1;
    this.pending.set(request.id, request);
  }
  async cancel(id: string) {
    this.check('cancel');
    this.calls.cancel += 1;
    this.pending.delete(id);
  }
  async getScheduled() {
    this.check('getScheduled');
    return [...this.pending.values()].map(toSystem);
  }
  async getPresented() {
    return [...this.delivered.values()];
  }
  async dismiss(id: string) {
    this.check('dismiss');
    this.calls.dismiss += 1;
    this.delivered.delete(id);
  }
  onTap() {
    return { remove: () => undefined };
  }

  /** The system delivers a pending notification: it moves to Notification Center. */
  deliver(id: string) {
    const request = this.pending.get(id);
    if (!request) throw new Error(`nothing pending with id ${id}`);
    this.pending.delete(id);
    this.delivered.set(id, toSystem(request));
  }

  times(): string[] {
    return [...this.pending.values()].flatMap((request) =>
      request.trigger.type === 'localDateTime'
        ? [`${request.trigger.hour}:${String(request.trigger.minute).padStart(2, '0')}`]
        : [],
    );
  }
}
