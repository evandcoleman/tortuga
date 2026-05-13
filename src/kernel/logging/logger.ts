import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const isDev = process.env.NODE_ENV !== 'production';

export const root = pino({
  level,
  transport: isDev && level !== 'silent'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export function createLogger(module: string) {
  return root.child({ module });
}

export type Logger = ReturnType<typeof createLogger>;
