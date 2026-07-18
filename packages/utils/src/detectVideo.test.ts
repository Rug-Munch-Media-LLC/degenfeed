/**
 * @degenfeed/utils — Video detection tests
 */

import { describe, expect, it } from 'vitest';
import {
  detectVideoFromEmbeds,
  isShortFormVideo,
  parseDirectVideoUrl,
  parsePeerTubeUrl,
  parseVideoUrl,
  parseYouTubeUrl,
} from './detectVideo';

describe('parseYouTubeUrl', () => {
  it('should parse standard YouTube URLs', () => {
    const result = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('dQw4w9WgXcQ');
    expect(result?.platform).toBe('youtube');
  });

  it('should parse shortened youtu.be URLs', () => {
    const result = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('dQw4w9WgXcQ');
  });

  it('should parse YouTube shorts URLs', () => {
    const result = parseYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.id).toBe('dQw4w9WgXcQ');
    }
  });

  it('should return null for non-YouTube URLs', () => {
    expect(parseYouTubeUrl('https://vimeo.com/123')).toBeNull();
  });
});

describe('parsePeerTubeUrl', () => {
  it('should parse PeerTube watch URLs', () => {
    const result = parsePeerTubeUrl('https://video.degenfeed.xyz/w/abc123');
    expect(result).not.toBeNull();
    expect(result?.instance).toBe('video.degenfeed.xyz');
  });

  it('should return null for non-PeerTube URLs', () => {
    expect(parsePeerTubeUrl('https://youtube.com/watch?v=abc')).toBeNull();
  });
});

describe('parseDirectVideoUrl', () => {
  it('should detect common video file extensions', () => {
    expect(parseDirectVideoUrl('https://example.com/video.mp4')).not.toBeNull();
    expect(parseDirectVideoUrl('https://example.com/video.webm')).not.toBeNull();
  });

  it('should return null for non-video file extensions', () => {
    expect(parseDirectVideoUrl('https://example.com/image.jpg')).toBeNull();
    expect(parseDirectVideoUrl('https://example.com/page.html')).toBeNull();
  });
});

describe('parseVideoUrl', () => {
  it('should detect YouTube URLs', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result?.platform).toBe('youtube');
  });

  it('should detect PeerTube URLs', () => {
    const result = parseVideoUrl('https://video.degenfeed.xyz/w/abc123');
    expect(result?.platform).toBe('peertube');
  });

  it('should detect direct video URLs', () => {
    const result = parseVideoUrl('https://cdn.example.com/video.mp4');
    expect(result?.platform).toBe('direct');
  });

  it('should return null for unknown URLs', () => {
    expect(parseVideoUrl('https://example.com/article')).toBeNull();
  });
});

describe('isShortFormVideo', () => {
  it('should return false for YouTube videos without short form indication', () => {
    const info = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    if (info) {
      expect(isShortFormVideo(info)).toBe(false);
    }
  });

  it('should return true for YouTube shorts', () => {
    const info = parseYouTubeUrl('https://www.youtube.com/shorts/abc123');
    if (info) {
      expect(isShortFormVideo(info)).toBe(true);
    }
  });
});

describe('detectVideoFromEmbeds', () => {
  it('should extract video info from link embeds', () => {
    const embeds = [
      { kind: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { kind: 'link', url: 'https://example.com/article' },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const videos = detectVideoFromEmbeds(embeds as any[]);
    expect(videos).not.toBeNull();
    expect(videos?.platform).toBe('youtube');
  });

  it('should return empty array for embeds without video URLs', () => {
    const embeds = [
      { kind: 'link', url: 'https://example.com/article' },
      { kind: 'image', url: 'https://example.com/image.jpg' },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const videos = detectVideoFromEmbeds(embeds as any[]);
    expect(videos).toBeNull();
  });
});
