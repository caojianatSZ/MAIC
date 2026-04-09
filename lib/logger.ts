const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return env in LOG_LEVELS ? (env as LogLevel) : 'info';
}

function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT === 'json';
}

function formatLine(level: LogLevel, tag: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const upperLevel = level.toUpperCase();

  // 处理Error对象和普通数据
  const processedArgs = args.map((a) => {
    if (a instanceof Error) {
      return {
        message: a.message,
        stack: a.stack,
        name: a.name,
        ...(a as any), // 包含其他错误属性
      };
    }
    if (typeof a === 'object' && a !== null) {
      return a;
    }
    if (typeof a === 'string') {
      return a;
    }
    return JSON.stringify(a);
  });

  const msg = processedArgs.length === 1
    ? processedArgs[0]
    : processedArgs;

  if (isJsonFormat()) {
    return JSON.stringify({
      timestamp,
      level: upperLevel,
      tag,
      message: msg,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
    });
  }

  // 文本格式
  const msgStr = args
    .map((a) =>
      a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a),
    )
    .join(' ');

  return `[${timestamp}] [${upperLevel}] [${tag}] ${msgStr}`;
}

export function createLogger(tag: string) {
  const emit = (level: LogLevel, args: unknown[]) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[getMinLevel()]) return;

    const line = formatLine(level, tag, args);

    // Console output
    const fn =
      level === 'debug'
        ? console.debug
        : level === 'warn'
          ? console.warn
          : level === 'error'
            ? console.error
            : console.log;
    fn(line);
  };

  return {
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}
