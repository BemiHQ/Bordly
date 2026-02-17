import { ENV } from '@/utils/env';

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  WELCOME: '/welcome',
};

export const API_ENDPOINTS = {
  AUTH_LOG_OUT: `${ENV.VITE_API_ENDPOINT}/auth/log-out`,
};
