/**
 * Expo push tokens let anyone who has one notify the device through Milo's
 * Expo project: they are never logged whole. A log line names a device by its
 * id; where a token has to show (an error text from Expo quotes it), only its
 * last characters do.
 */

const TOKEN = /Expo(?:nent)?PushToken\[[^\]]*\]/g;

/** `ExponentPushToken[AbCd…WxYz]` → `ExponentPushToken[…WxYz]`. */
export function maskPushToken(token: string): string {
  const match = /^(Expo(?:nent)?PushToken)\[(.*)\]$/.exec(token);
  if (!match) return '[token]';
  const inner = match[2] ?? '';
  return `${match[1]}[…${inner.length > 12 ? inner.slice(-4) : ''}]`;
}

/** Every Expo push token in a text, masked. */
export function redactPushTokens(text: string): string {
  return text.replace(TOKEN, (token) => maskPushToken(token));
}
