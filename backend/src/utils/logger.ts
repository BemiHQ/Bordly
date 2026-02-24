import { ENV } from '@/utils/env';

export class Logger {
  static log(...args: unknown[]) {
    if (ENV.NODE_ENV === 'production') return;

    console.log(...args);
  }

  static logObjects(objs: unknown[]) {
    if (ENV.NODE_ENV === 'production') return;

    Logger.log('\n---\n');
    objs.forEach((obj, index) => {
      typeof obj === 'string' ? Logger.log(obj) : Logger.logObject(obj);
      if (index < objs.length - 1) Logger.log('\n---\n');
    });
  }

  static logObject(obj: unknown) {
    if (ENV.NODE_ENV === 'production') return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      Logger.log(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);
    }
  }

  static info(...args: unknown[]) {
    console.info(...args);
  }

  static error(...args: unknown[]) {
    console.error(...args);
  }
}
