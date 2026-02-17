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
