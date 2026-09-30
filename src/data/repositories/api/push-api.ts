import type { ExpoPushToken, PushPlatform } from '@/schemas';
import type { ApiClient } from '@/services/api/api-client';

/** Team notifications on the Milo API: this device's registration, on or off. */
export interface PushApi {
  /** This signed-in session's device gets team notifications, at this token. */
  register(token: ExpoPushToken, platform: PushPlatform): Promise<void>;
  /** This session's device gets them no more. */
  unregister(): Promise<void>;
  /** A token this device had before signing out is forgotten — no account needed. */
  forget(token: ExpoPushToken): Promise<void>;
}

export class HttpPushApi implements PushApi {
  constructor(private readonly client: ApiClient) {}

  async register(token: ExpoPushToken, platform: PushPlatform): Promise<void> {
    await this.client.request({
      method: 'PUT',
      path: '/push/devices/current',
      body: { token, platform },
      auth: true,
    });
  }

  async unregister(): Promise<void> {
    await this.client.request({ method: 'DELETE', path: '/push/devices/current', auth: true });
  }

  async forget(token: ExpoPushToken): Promise<void> {
    await this.client.request({
      method: 'POST',
      path: '/push/devices/unregister',
      body: { token },
    });
  }
}
