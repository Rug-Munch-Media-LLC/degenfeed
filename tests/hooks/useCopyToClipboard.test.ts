/**
 * @degenfeed/web — useCopyToClipboard Hook Tests
 *
 * Covers:
 * - Initial state (not copied)
 * - Successful clipboard write sets copied to true
 * - copied auto-resets after 2 seconds
 * - Fallback to execCommand when clipboard API fails
 * - Timer cleanup
 */

// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should start with copied = false', async () => {
    // Mock navigator.clipboard
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [copied] = result.current;
    expect(copied).toBe(false);
  });

  it('should set copied to true after successful copy', async () => {
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [, copy] = result.current;

    await act(async () => {
      await copy('test text');
    });

    const [copied] = result.current;
    expect(copied).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
  });

  it('should reset copied to false after 2 seconds', async () => {
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [, copy] = result.current;

    await act(async () => {
      await copy('test text');
    });

    expect(result.current[0]).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const [copied] = result.current;
    expect(copied).toBe(false);
  });

  it('should fall back to execCommand when clipboard API is unavailable', async () => {
    // Remove clipboard API
    const clipboardMock = undefined;
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    // Mock document.execCommand
    document.execCommand = vi.fn().mockReturnValue(true);

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [, copy] = result.current;

    await act(async () => {
      await copy('fallback text');
    });

    const [copied] = result.current;
    expect(copied).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('should clear previous timer when copying again', async () => {
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [, copy] = result.current;

    await act(async () => {
      await copy('first');
    });
    expect(result.current[0]).toBe(true);

    // Copy again before the 2s timer expires
    await act(async () => {
      await copy('second');
    });
    expect(result.current[0]).toBe(true);

    // After 2s from the second copy
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current[0]).toBe(false);
  });

  it('should copy the exact text provided', async () => {
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      configurable: true,
    });

    const { useCopyToClipboard } = await import('../../apps/web/src/hooks/useCopyToClipboard');
    const { result } = renderHook(() => useCopyToClipboard());

    const [, copy] = result.current;

    const longText = 'https://degenfeed.xyz/post/0x1234567890abcdef';
    await act(async () => {
      await copy(longText);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longText);
  });
});
