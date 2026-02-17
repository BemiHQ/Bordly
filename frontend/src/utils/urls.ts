import { ENV } from '@/utils/env';

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  WELCOME: '/welcome',
  BOARD: '/boards/$boardId',
  INTERNAL_HEALTH: '/internal/health',
};

export const API_ENDPOINTS = {
  TRPC: `${ENV.VITE_API_ENDPOINT}/trpc`,
  AUTH_GOOGLE: `${ENV.VITE_API_ENDPOINT}/auth/google`,
  AUTH_LOG_OUT: `${ENV.VITE_API_ENDPOINT}/auth/log-out`,
};
