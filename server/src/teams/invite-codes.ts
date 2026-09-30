import { createHmac, hkdfSync } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { inviteCodeFromBytes } from '@/features/friends/logic/invite-code';
import type { InviteCode } from '@/schemas';

import { APP_CONFIG, type AppConfig } from '../config/env';

/**
 * Invite codes, never stored. A code is derived from its invite's id with a
 * key of the server's own — so any member can be shown their team's code
 * again — and the invite is found by the code's keyed hash. A copy of the
 * database alone holds no code that works.
 *
 * The key is derived from `REFRESH_TOKEN_SECRET` (nothing new to configure);
 * changing that secret signs everyone out and turns every open invite off.
 */
@Injectable()
export class InviteCodes {
  private readonly key: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.key = Buffer.from(
      hkdfSync('sha256', config.refreshToken.secret, 'milo', 'team invite codes v1', 32),
    );
  }

  /** The code of an invite. */
  codeFor(inviteId: string): InviteCode {
    return inviteCodeFromBytes(this.mac(`code:${inviteId}`));
  }

  /** What the invite is found by: the code's keyed hash. */
  hash(code: InviteCode): string {
    return this.mac(`lookup:${code}`).toString('hex');
  }

  private mac(message: string): Buffer {
    return createHmac('sha256', this.key).update(message).digest();
  }
}
