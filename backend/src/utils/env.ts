const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

export const ENV = {
  DB_DATABASE: requireEnv('DB_DATABASE'),
  DB_USERNAME: requireEnv('DB_USERNAME'),
  DB_PASSWORD: requireEnv('DB_PASSWORD'),
  DB_HOSTNAME: requireEnv('DB_HOSTNAME'),
  DB_PORT: parseInt(requireEnv('DB_PORT'), 10),

  ENCRYPTION_KEY: requireEnv('ENCRYPTION_KEY'),
  COOKIE_SECRET: requireEnv('COOKIE_SECRET'),

  ROOT_DOMAIN: requireEnv('ROOT_DOMAIN'),
  APP_ENDPOINT: requireEnv('APP_ENDPOINT'),

  GOOGLE_OAUTH_CLIENT_ID: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
  GOOGLE_OAUTH_CLIENT_SECRET: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
  GOOGLE_OAUTH_CALLBACK_URL: requireEnv('GOOGLE_OAUTH_CALLBACK_URL'),

  LLM_FAST_MODEL: requireEnv('LLM_FAST_MODEL'),
  LLM_THINKING_MODEL: requireEnv('LLM_THINKING_MODEL'),

  // Optional

  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  DB_SSL: process.env.DB_SSL === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',

  AWS_REGION: process.env.AWS_REGION,
  AWS_SES_ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID,
  AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY,

  SENTRY_DSN: process.env.SENTRY_DSN,
};
