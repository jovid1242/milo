type LogPayload = Record<string, unknown> | unknown;

/**
 * Thin logging facade. Development: console. Production: warnings/errors only,
 * so a crash-reporting sink can be plugged in here later without touching callers.
 */
export const logger = {
  debug(message: string, payload?: LogPayload) {
    if (__DEV__) console.log(`[milo] ${message}`, payload ?? '');
  },
  warn(message: string, payload?: LogPayload) {
    console.warn(`[milo] ${message}`, payload ?? '');
  },
  error(message: string, error?: unknown) {
    console.error(`[milo] ${message}`, error ?? '');
  },
};
