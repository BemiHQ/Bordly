import * as Sentry from '@sentry/node';

import { ENV } from '@/utils/env';

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  enabled: !!ENV.SENTRY_DSN,
  integrations: [],
  tracesSampleRate: 0.0,
  profilesSampleRate: 0.0,
  sendDefaultPii: false,
});

export const setupFastifyErrorHandler = Sentry.setupFastifyErrorHandler;

export const reportError = (error: unknown, tags: { [key: string]: string } = {}) => {
  if (ENV.SENTRY_DSN) {
    Sentry.captureException(error, { tags });
  }
  const e = error instanceof Error ? error : new Error(String(error));
  console.error(`${e.name}: ${e.message}\n${e.stack}`);
};
