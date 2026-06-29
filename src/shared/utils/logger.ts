type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const envLevel = (process.env.LOG_LEVEL?.toLowerCase() as Level | undefined)
  ?? (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
const minLevel = LEVELS[envLevel] ?? LEVELS.debug;

function log(level: Level, ...args: unknown[]): void {
  if (LEVELS[level] < minLevel) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(...args);
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info:  (...args: unknown[]) => log('info', ...args),
  warn:  (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
