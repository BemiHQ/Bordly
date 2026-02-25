import { ENV } from '@/utils/env';

export class Logger {
  static debug(...args: unknown[]) {
    if (ENV.NODE_ENV === 'production') return;

    console.log(...args);
  }

  static debugObjects(objs: unknown[]) {
    if (ENV.NODE_ENV === 'production') return;

    Logger.debug('\n---\n');
    objs.forEach((obj, index) => {
      typeof obj === 'string' ? Logger.debug(obj) : Logger.debugObject(obj);
      if (index < objs.length - 1) Logger.debug('\n---\n');
    });
  }

  static debugObject(obj: unknown) {
    if (ENV.NODE_ENV === 'production') return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      Logger.debug(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);
    }
  }

  static info(...args: unknown[]) {
    console.info(...args);
  }

  static error(...args: unknown[]) {
    console.error(...args);
  }
}
