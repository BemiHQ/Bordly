export const ENV = {
  DB_DATABASE: process.env.DB_DATABASE as string,
  DB_USERNAME: process.env.DB_USERNAME as string,
  DB_PASSWORD: process.env.DB_PASSWORD as string,
  DB_HOSTNAME: process.env.DB_HOSTNAME as string,
  DB_PORT: parseInt(process.env.DB_PORT as string, 10),
  DB_SSL: process.env.DB_SSL === 'true',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY as string,
  COOKIE_SECRET: process.env.COOKIE_SECRET as string,

  ROOT_DOMAIN: process.env.ROOT_DOMAIN as string,
  APP_ENDPOINT: process.env.APP_ENDPOINT as string,

  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
  GOOGLE_OAUTH_CALLBACK_URL: process.env.GOOGLE_OAUTH_CALLBACK_URL as string,

  LLM_FAST_MODEL: process.env.LLM_FAST_MODEL as string,
  LLM_THINKING_MODEL: process.env.LLM_THINKING_MODEL as string,

  // Optional

  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,

  AWS_REGION: process.env.AWS_REGION,
  AWS_SES_ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID,
  AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY,

  SENTRY_DSN: process.env.SENTRY_DSN,
};
