import { z } from 'zod';

import { redactPushTokens } from './push-token';

/**
 * Expo's push service: it takes messages for Expo push tokens and hands them
 * to Firebase Cloud Messaging (Android). A message it accepts gets a ticket;
 * the receipt for that ticket, about 15 minutes later, tells whether FCM took
 * it. Neither is proof that the phone showed it.
 */

/** One notification for one device, as Expo's push API takes it. */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** The Android channel (created by the app). */
  channelId: string;
  sound: 'default';
  priority: 'high';
  /** Seconds FCM keeps it for a phone that is offline: old news is not delivered. */
  ttl: number;
};

const ErrorDetailsSchema = z.object({ error: z.string().optional() }).optional();

const TicketSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.string().min(1) }),
  z.object({ status: z.literal('error'), message: z.string(), details: ErrorDetailsSchema }),
]);
export type ExpoPushTicket = z.infer<typeof TicketSchema>;

const ReceiptSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('error'), message: z.string(), details: ErrorDetailsSchema }),
]);
export type ExpoPushReceipt = z.infer<typeof ReceiptSchema>;

const SendResponseSchema = z.object({ data: z.array(TicketSchema) });
const ReceiptsResponseSchema = z.object({ data: z.record(z.string(), ReceiptSchema) });
const ErrorsSchema = z.object({ errors: z.array(z.object({ code: z.string() })) });

/** Expo's own limits per request. */
export const SEND_CHUNK = 100;
export const RECEIPTS_CHUNK = 300;

/** A request Expo did not answer with tickets or receipts. */
export class ExpoPushError extends Error {
  constructor(
    message: string,
    /** Worth trying again later: no answer, 429, or a 5xx. */
    readonly retryable: boolean,
    readonly status: number | null = null,
    /** What Expo's `Retry-After` asked for. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'ExpoPushError';
  }
}

export interface PushTransport {
  /** Tickets, in the order of the messages. Throws `ExpoPushError` when the request failed as a whole. */
  send(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  /** Receipts by ticket id; a receipt that is not ready yet is missing. */
  receipts(ids: readonly string[]): Promise<Record<string, ExpoPushReceipt>>;
}

/** How the push module reaches Expo — the HTTP API, or a fake in tests. */
export const PUSH_TRANSPORT = Symbol('PUSH_TRANSPORT');

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const TIMEOUT_MS = 15_000;

function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** Expo's error codes from a refused request — never its messages, which may quote tokens. */
function errorCodes(text: string): string {
  try {
    const parsed = ErrorsSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data.errors.map((error) => error.code).join(', ');
  } catch {
    // Not JSON: nothing but the status to go on.
  }
  return redactPushTokens(text).slice(0, 120);
}

/** Expo's push API over HTTPS, with the project's access token when it requires one. */
export class ExpoHttpTransport implements PushTransport {
  constructor(
    private readonly accessToken: string | null,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async send(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const parsed = SendResponseSchema.safeParse(await this.post(SEND_URL, messages));
    if (!parsed.success || parsed.data.data.length !== messages.length)
      throw new ExpoPushError('Expo answered without a ticket for every message', false, 200);
    return parsed.data.data;
  }

  async receipts(ids: readonly string[]): Promise<Record<string, ExpoPushReceipt>> {
    const parsed = ReceiptsResponseSchema.safeParse(await this.post(RECEIPTS_URL, { ids }));
    if (!parsed.success) throw new ExpoPushError('Expo answered without receipts', false, 200);
    return parsed.data.data;
  }

  private async post(url: string, payload: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
          ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      // No answer at all: the network, DNS, a timeout.
      const name = error instanceof Error ? error.name : 'Error';
      throw new ExpoPushError(`Expo's push service could not be reached (${name})`, true);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new ExpoPushError(
        `Expo's push service answered ${response.status}`,
        true,
        response.status,
        retryAfterMs(response.headers.get('retry-after')),
      );
    }
    const text = await response.text();
    if (!response.ok) {
      // Any other 4xx: this request will not work as it is (credentials, a malformed message).
      throw new ExpoPushError(
        `Expo's push service refused the request (${response.status}: ${errorCodes(text)})`,
        false,
        response.status,
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ExpoPushError('Expo answered with something that is not JSON', false, 200);
    }
  }
}

/**
 * In tests nothing ever reaches Expo: without a fake, sending fails loudly.
 */
export const refusingTransport: PushTransport = {
  send() {
    return Promise.reject(new Error('Tests never send real pushes: give the app a fake transport'));
  },
  receipts() {
    return Promise.reject(new Error('Tests never ask Expo for receipts: give the app a fake'));
  },
};
