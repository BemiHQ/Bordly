import { ENV } from '@/utils/env';

export const ROUTES = {
  AUTH_GOOGLE: '/auth/google',
  AUTH_GOOGLE_CALLBACK: '/auth/google/callback',
  AUTH_LOG_OUT: '/auth/log-out',
  INTERNAL_HEALTH: '/internal/health',
  PROXY_ICON: '/proxy/icon',
  PROXY_GMAIL_ATTACHMENT: '/proxy/gmail-attachment',
  FILE_ATTACHMENT_UPLOAD: '/file-attachments/upload',
  FILE_ATTACHMENT_DELETE: '/file-attachments/delete',
  TRPC: '/trpc',
};

export const APP_ENDPOINTS = {
  BOARD: `${ENV.APP_ENDPOINT}/boards/$boardId`,
};
