import '@fastify/session';

declare module 'fastify' {
  interface Session {
    userId?: string;
  }
}
