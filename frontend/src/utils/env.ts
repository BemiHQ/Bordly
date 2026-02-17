export const ENV = {
  VITE_API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT as string,

  // Optional

  VITE_API_ENDPOINT_SSR: import.meta.env.VITE_API_ENDPOINT_SSR,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
};
