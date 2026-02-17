import type { FastifyInstance } from 'fastify';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { ROUTES } from '@/utils/urls';

const ALLOWED_CONTENT_TYPES = [
  'image/x-icon',
  'image/png',
  'image/vnd.microsoft.icon',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
];

const REQUEST_TIMEOUT_MS = 2_000;
const MAX_ICON_SIZE = 1024 * 1024; // 1MB

export const proxyRoutes = async (fastify: FastifyInstance) => {
  fastify.get(ROUTES.PROXY_ICON, async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400);

    const referer = request.headers.referer;
    if (!referer || !referer.startsWith(ENV.APP_ENDPOINT)) {
      throw new Error(`Unauthorized referer: ${referer} (${url})`);
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') throw new TypeError(`Invalid URL protocol (${url})`);

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Failed to fetch icon: ${response.statusText} (${url})`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type))) {
        throw new TypeError(`Invalid content type: ${contentType} (${url})`);
      }

      const iconBuffer = await response.arrayBuffer();
      if (iconBuffer.byteLength > MAX_ICON_SIZE) {
        throw new TypeError(`Icon size exceeds maximum limit (${url})`);
      }

      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=2592000, immutable')
        .header('ETag', `"${Buffer.from(url).toString('base64')}"`)
        .header('Vary', 'Accept-Encoding')
        .header('Access-Control-Allow-Origin', ENV.APP_ENDPOINT)
        .header('X-Content-Type-Options', 'nosniff')
        .send(Buffer.from(iconBuffer));
    } catch (error) {
      reportError(error);
      if (error instanceof TypeError) return reply.status(400);
      return reply.status(500);
    }
  });
};
