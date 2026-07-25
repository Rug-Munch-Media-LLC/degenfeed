/**
 * @degenfeed/monitoring — Structured logging, health checks, and timing utilities
 *
 * Usage:
 *   import { createLogger, measureDuration } from '@degenfeed/monitoring';
 *   const log = createLogger('api');
 *   log.info('Server started', { port: 3000 });
 *   const result = await measureDuration('db.query', () => db.query(...));
 */

// == Logger ==============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  name: string;
  message: string;
  data?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CONSOLE_METHOD: Record<LogLevel, keyof Console> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

export interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, err?: Error, data?: Record<string, unknown>) => void;
  child: (name: string) => Logger;
}

let globalLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[globalLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function createLogger(name: string): Logger {
  const log =
    (level: LogLevel) =>
    (
      message: string,
      dataOrErr?: Record<string, unknown> | Error,
      data?: Record<string, unknown>,
    ) => {
      if (!shouldLog(level)) return;

      const entry: LogEntry = {
        level,
        timestamp: formatTimestamp(),
        name,
        message,
      };

      if (level === 'error' && dataOrErr instanceof Error) {
        entry.error = {
          message: dataOrErr.message,
          stack: dataOrErr.stack,
        };
        if (data) entry.data = data;
      } else if (dataOrErr && typeof dataOrErr === 'object') {
        entry.data = dataOrErr as Record<string, unknown>;
      }

      const consoleMethod = CONSOLE_METHOD[level];
      if (level === 'error' && entry.error) {
        console[consoleMethod](JSON.stringify(entry));
      } else {
        console[consoleMethod](JSON.stringify(entry));
      }
    };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: (childName: string) => createLogger(`${name}:${childName}`),
  };
}

// == Timing ==============================================================

interface DurationMeasurement {
  name: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

type TimingCallback = (measurement: DurationMeasurement) => void;

const timingCallbacks: TimingCallback[] = [];

export function onMeasure(callback: TimingCallback): void {
  timingCallbacks.push(callback);
}

export async function measureDuration<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  let success = false;
  try {
    const result = await fn();
    success = true;
    return result;
  } finally {
    const durationMs = performance.now() - start;
    const measurement: DurationMeasurement = {
      name,
      durationMs: Math.round(durationMs * 100) / 100,
      success,
      timestamp: formatTimestamp(),
    };
    for (const cb of timingCallbacks) {
      try {
        cb(measurement);
      } catch {
        // swallow callback errors
      }
    }
  }
}

export function measureDurationSync<T>(name: string, fn: () => T): T {
  const start = performance.now();
  let success = false;
  try {
    const result = fn();
    success = true;
    return result;
  } finally {
    const durationMs = performance.now() - start;
    const measurement: DurationMeasurement = {
      name,
      durationMs: Math.round(durationMs * 100) / 100,
      success,
      timestamp: formatTimestamp(),
    };
    for (const cb of timingCallbacks) {
      try {
        cb(measurement);
      } catch {
        // swallow callback errors
      }
    }
  }
}

// == Health ==============================================================

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, { status: string; latency?: number; error?: string }>;
}

export async function healthCheck(
  customChecks?: Record<string, () => Promise<{ status: string; latency?: number }>>,
): Promise<HealthCheckResult> {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Built-in uptime check
  checks.process = { status: 'ok', latency: 0 };

  // Custom checks
  if (customChecks) {
    for (const [name, checkFn] of Object.entries(customChecks)) {
      const start = performance.now();
      try {
        const result = await checkFn();
        checks[name] = {
          status: result.status,
          latency: Math.round((performance.now() - start) * 100) / 100,
        };
      } catch (err) {
        checks[name] = {
          status: 'down',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const failedCount = Object.values(checks).filter((c) => c.status !== 'ok').length;
  const status: HealthCheckResult['status'] =
    failedCount === 0 ? 'ok' : failedCount <= Object.keys(checks).length / 2 ? 'degraded' : 'down';

  let version = '0.0.0';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    version = require('../package.json').version || version;
  } catch {
    // fallback
  }

  return {
    status,
    timestamp: formatTimestamp(),
    version,
    uptime: process.uptime(),
    checks,
  };
}

// == Metrics helpers =====================================================

export function formatMetricValue(value: number, unit: 'ms' | 's' | 'count' | 'percent'): string {
  switch (unit) {
    case 'ms':
      return `${Math.round(value)}ms`;
    case 's':
      return `${value.toFixed(2)}s`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return String(Math.round(value));
  }
}
