import { ENV } from '@/utils/env';

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  WELCOME: '/welcome',
  BOARD: '/boards/$boardId',
  BOARD_CARD: '/boards/$boardId/c/$boardCardId',
  INTERNAL_HEALTH: '/internal/health',
};

export const API_ENDPOINTS = {
  TRPC: `${ENV.VITE_API_ENDPOINT}/trpc`,
  TRPC_SSR: `${ENV.SSR_API_ENDPOINT}/trpc`,
  AUTH_GOOGLE: `${ENV.VITE_API_ENDPOINT}/auth/google`,
  AUTH_LOG_OUT: `${ENV.VITE_API_ENDPOINT}/auth/log-out`,
  PROXY_ICON: `${ENV.VITE_API_ENDPOINT}/proxy/icon`,
  PROXY_GMAIL_ATTACHMENT: `${ENV.VITE_API_ENDPOINT}/proxy/gmail-attachment`,
  FILE_ATTACHMENT_UPLOAD: `${ENV.VITE_API_ENDPOINT}/file-attachments/upload`,
  FILE_ATTACHMENT_DELETE: `${ENV.VITE_API_ENDPOINT}/file-attachments/delete`,
};
