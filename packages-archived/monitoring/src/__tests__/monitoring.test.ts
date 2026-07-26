import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, healthCheck, measureDuration, setLogLevel } from '../index';

describe('createLogger', () => {
  beforeEach(() => {
    setLogLevel('debug');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should create a logger with the given name', () => {
    const log = createLogger('test');
    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
  });

  it('should log info messages as JSON', () => {
    const log = createLogger('test');
    log.info('hello world', { foo: 'bar' });
    expect(console.info).toHaveBeenCalledTimes(1);
    const callArg = (console.info as unknown as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed.level).toBe('info');
    expect(parsed.name).toBe('test');
    expect(parsed.message).toBe('hello world');
    expect(parsed.data?.foo).toBe('bar');
  });

  it('should log error messages with error details', () => {
    const log = createLogger('test');
    const err = new Error('something broke');
    log.error('failed', err, { requestId: 'abc' });
    expect(console.error).toHaveBeenCalledTimes(1);
    const callArg = (console.error as unknown as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed.level).toBe('error');
    expect(parsed.error?.message).toBe('something broke');
    expect(parsed.data?.requestId).toBe('abc');
  });

  it('should respect log level filtering', () => {
    setLogLevel('warn');
    const log = createLogger('test');
    log.info('should be hidden');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('should create child loggers', () => {
    const log = createLogger('parent');
    const child = log.child('child');
    child.info('from child');
    const callArg = (console.info as unknown as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed.name).toBe('parent:child');
  });
});

describe('measureDuration', () => {
  it('should measure async function duration', async () => {
    const result = await measureDuration('test', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
  });

  it('should measure sync function duration', async () => {
    const result = await measureDuration('test', () => 42);
    expect(result).toBe(42);
  });

  it('should re-throw errors from the wrapped function', async () => {
    await expect(
      measureDuration('test', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

describe('healthCheck', () => {
  it('should return ok status when all checks pass', async () => {
    const result = await healthCheck({
      db: async () => ({ status: 'ok' }),
      cache: async () => ({ status: 'ok' }),
    });
    expect(result.status).toBe('ok');
    expect(result.checks.process).toBeDefined();
    expect(result.checks.db).toBeDefined();
    expect(result.checks.cache).toBeDefined();
    expect(typeof result.uptime).toBe('number');
  });

  it('should return degraded when some checks fail', async () => {
    const result = await healthCheck({
      db: async () => ({ status: 'ok' }),
      broken: async () => {
        throw new Error('timeout');
      },
    });
    expect(result.status).toBe('degraded');
    expect(result.checks.broken?.error).toContain('timeout');
  });

  it('should return down when all checks fail', async () => {
    const result = await healthCheck({
      a: async () => {
        throw new Error('fail');
      },
      b: async () => {
        throw new Error('fail');
      },
    });
    expect(result.status).toBe('down');
  });
});
