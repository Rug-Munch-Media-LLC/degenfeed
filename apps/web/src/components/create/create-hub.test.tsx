/**
 * @degenfeed/web — Unified Create hub tests
 *
 * Covers: format utilities, FormatPicker selection, premium platform
 * gating, the Create hub option grid, the VOD flow (format override +
 * schedule + publish), the Live flow (format → platforms → go live),
 * and the mobile CreateBottomSheet.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateBottomSheet } from './CreateBottomSheet';
import { CreateHubContent } from './CreateHubContent';
import { FormatPicker } from './FormatPicker';
import { CREATOR_PLATFORMS, createOption, detectFormatFromVideo, formatMeta } from './format';
import { LiveCreatorFlow } from './LiveCreatorFlow';
import { PlatformMultiSelect } from './PlatformMultiSelect';
import { VODCreatorFlow } from './VODCreatorFlow';

// === Mocks ===============================================================

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    ready: true,
    walletAddress: '0xTEST',
    signedInProtocols: { farcaster: true, nostr: true },
    openSignIn: vi.fn(),
    openCompose: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePremium', () => ({
  usePremium: () => ({ tier: 'basic', isPremium: false, loading: false, refresh: vi.fn() }),
}));

// The VOD flow imports the studio DropZone — render a lightweight stub.
vi.mock('../../app/creator/video/DropZone', () => ({
  default: ({ onFile, label }: { onFile: (files: File[]) => void; label: string }) => (
    <button type="button" onClick={() => onFile([new File(['x'], 'clip.mp4')])}>
      {label}
    </button>
  ),
}));

function makeVideoElement(width: number, height: number): HTMLVideoElement {
  const el = document.createElement('video') as HTMLVideoElement & {
    videoWidth: number;
    videoHeight: number;
  };
  el.videoWidth = width;
  el.videoHeight = height;
  return el as unknown as HTMLVideoElement;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  // happy-dom MediaRecorder stubs
  vi.stubGlobal(
    'MediaRecorder',
    class {
      state = 'inactive';
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
      }
    },
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// === format utilities ====================================================

describe('format utilities', () => {
  it('formatMeta resolves both formats', () => {
    expect(formatMeta('portrait').ratioLabel).toBe('9:16');
    expect(formatMeta('landscape').ratioLabel).toBe('16:9');
  });

  it('formatMeta falls back safely for unknown ids', () => {
    // @ts-expect-error intentionally passing an invalid id
    const meta = formatMeta('square');
    expect(meta.id).toBe('landscape');
  });

  it('createOption exposes the five hub options', () => {
    expect(createOption('short').label).toBe('Short Video');
    expect(createOption('live').label).toBe('Go Live');
    expect(createOption('post').label).toBe('Write Post');
    expect(createOption('podcast').label).toBe('Record Podcast');
  });

  it('detectFormatFromVideo auto-detects portrait vs landscape', () => {
    expect(detectFormatFromVideo(makeVideoElement(1080, 1920))).toBe('portrait');
    expect(detectFormatFromVideo(makeVideoElement(1920, 1080))).toBe('landscape');
    expect(detectFormatFromVideo(null)).toBeNull();
  });

  it('platform list includes premium YouTube & Twitch flags', () => {
    const yt = CREATOR_PLATFORMS.find((p) => p.id === 'youtube');
    const tw = CREATOR_PLATFORMS.find((p) => p.id === 'twitch');
    expect(yt?.premium).toBe(true);
    expect(tw?.premium).toBe(true);
    expect(CREATOR_PLATFORMS.find((p) => p.id === 'nostr')?.premium).toBeUndefined();
  });
});

// === FormatPicker ========================================================

describe('FormatPicker', () => {
  it('selects landscape when the horizontal card is chosen', () => {
    const onChange = vi.fn();
    render(<FormatPicker value="portrait" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Horizontal/));
    expect(onChange).toHaveBeenCalledWith('landscape');
  });

  it('marks the active format card', () => {
    render(<FormatPicker value="portrait" onChange={() => {}} />);
    const radio = screen.getByLabelText(/Vertical/) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });
});

// === PlatformMultiSelect =================================================

describe('PlatformMultiSelect', () => {
  it('disables premium platforms for free users with a lock hint', () => {
    const onToggle = vi.fn();
    render(
      <PlatformMultiSelect
        platforms={CREATOR_PLATFORMS}
        selected={new Set(['nostr'])}
        onToggle={onToggle}
        mode="live"
      />,
    );
    const yt = screen.getByRole('button', { name: /YouTube/ }) as HTMLButtonElement;
    expect(yt.disabled).toBe(true);
    expect(screen.getByText(/Pro features/)).toBeTruthy();
    fireEvent.click(yt);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('allows toggling free platforms', () => {
    const onToggle = vi.fn();
    render(
      <PlatformMultiSelect
        platforms={CREATOR_PLATFORMS}
        selected={new Set()}
        onToggle={onToggle}
        mode="vod"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Nostr/ }));
    expect(onToggle).toHaveBeenCalledWith('nostr');
  });
});

// === Create Hub ==========================================================

describe('CreateHubContent', () => {
  it('renders the single entry point with all five create options', () => {
    render(<CreateHubContent />);
    expect(screen.getByText('What do you want to create?')).toBeTruthy();
    expect(screen.getByText('Short Video')).toBeTruthy();
    expect(screen.getByText('Long Video')).toBeTruthy();
    expect(screen.getByText('Go Live')).toBeTruthy();
    expect(screen.getByText('Write Post')).toBeTruthy();
    expect(screen.getByText('Record Podcast')).toBeTruthy();
    expect(screen.getByText('Quick capture')).toBeTruthy();
  });

  it('links short video to the portrait VOD flow', () => {
    render(<CreateHubContent />);
    const shortLink = screen.getByRole('link', { name: /Short Video/ });
    expect(shortLink.getAttribute('href')).toBe('/create/video?format=portrait');
  });

  it('links long video to the landscape VOD flow', () => {
    render(<CreateHubContent />);
    const longLink = screen.getByRole('link', { name: /Long Video/ });
    expect(longLink.getAttribute('href')).toBe('/create/video?format=landscape');
  });
});

// === VOD flow ============================================================

describe('VODCreatorFlow', () => {
  it('auto-detects portrait format from a portrait clip and lets the user override', async () => {
    render(<VODCreatorFlow />);
    // The stubbed DropZone triggers handleFile with clip.mp4
    fireEvent.click(screen.getByText('Upload from device'));
    await waitFor(() => expect(screen.getByText('Format')).toBeTruthy());

    // Override to landscape
    fireEvent.click(screen.getByRole('button', { name: /Horizontal/ }));
    expect(screen.getByText('manually overridden')).toBeTruthy();
  });

  it('lets the creator schedule a publish time and reach the preview', async () => {
    render(<VODCreatorFlow />);
    fireEvent.click(screen.getByText('Upload from device'));
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My Test Clip' } });

    // Schedule 1 hour from now
    const future = new Date(Date.now() + 3600_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    fireEvent.change(screen.getByLabelText('Publish time'), { target: { value: local } });
    expect(screen.getByText(/Scheduled — will publish automatically/)).toBeTruthy();

    // Platforms are pre-selected (degenfeed); go to preview
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText('Platform preview')).toBeTruthy());

    // Publish (scheduled)
    fireEvent.click(screen.getByRole('button', { name: /Schedule Publish/ }));
    await waitFor(() => expect(screen.getByText('Video Scheduled!')).toBeTruthy());
  });

  it('publishes immediately when the time is now', async () => {
    render(<VODCreatorFlow />);
    fireEvent.click(screen.getByText('Upload from device'));
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Now Clip' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText('Platform preview')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(screen.getByText('Video Published!')).toBeTruthy());
  });
});

// === Live flow ===========================================================

describe('LiveCreatorFlow', () => {
  it('walks the format → platforms → details → go live pipeline', async () => {
    render(<LiveCreatorFlow initialFormat="portrait" />);

    // Step 1: format
    expect(screen.getByText('Choose a format')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose platforms' }));

    // Step 2: platforms (owncast+peertube pre-selected, toggle nostr)
    fireEvent.click(screen.getByRole('button', { name: /Nostr/ }));
    fireEvent.click(screen.getByRole('button', { name: /3 platforms — continue/ }));

    // Step 3: details
    fireEvent.change(screen.getByLabelText('Stream title'), { target: { value: 'Test Stream' } });
    fireEvent.click(screen.getByRole('button', { name: /Go Live \(Vertical\)/ }));

    // Orchestration → live
    await waitFor(() => expect(screen.getByText(/LIVE · Vertical/)).toBeTruthy(), {
      timeout: 5000,
    });
    expect(screen.getByText('End Stream')).toBeTruthy();
  });

  it('shows the horizontal format on the go-live button when landscape', async () => {
    render(<LiveCreatorFlow initialFormat="landscape" />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose platforms' }));
    fireEvent.click(screen.getByRole('button', { name: /2 platforms — continue/ }));
    fireEvent.change(screen.getByLabelText('Stream title'), { target: { value: 'Wide Stream' } });
    expect(screen.getByRole('button', { name: /Go Live \(Horizontal\)/ })).toBeTruthy();
  });
});

// === Mobile bottom sheet =================================================

describe('CreateBottomSheet', () => {
  it('renders all creation options when opened', () => {
    render(<CreateBottomSheet isOpen onClose={() => {}} />);
    expect(screen.getByText('Record')).toBeTruthy();
    expect(screen.getByText('Upload')).toBeTruthy();
    expect(screen.getByText('Short Video')).toBeTruthy();
    expect(screen.getByText('Go Live')).toBeTruthy();
    expect(screen.getByText('Write Post')).toBeTruthy();
  });

  it('returns null when closed', () => {
    const { container } = render(<CreateBottomSheet isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('links the go-live option to the live flow', () => {
    render(<CreateBottomSheet isOpen onClose={() => {}} />);
    const liveLink = screen.getByRole('link', { name: /Go Live/ });
    expect(liveLink.getAttribute('href')).toBe('/create/live');
  });
});
