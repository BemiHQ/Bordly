const requireEnv = (name: string): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

export const ENV = {
  VITE_API_ENDPOINT: requireEnv('VITE_API_ENDPOINT'),

  // Optional
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,

  // Runtime
  SSR_API_ENDPOINT: process.env.SSR_API_ENDPOINT,
};
