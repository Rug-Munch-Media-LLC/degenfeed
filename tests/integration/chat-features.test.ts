/**
 * @degenfeed/integration — Chat Features Tests
 *
 * Tests the enhanced chat features pipeline: reactions, edits, unsend,
 * delete-for-me/delete-for-everyone, auto-delete timers, disappearing messages,
 * media upload, voice notes, polls, file management, and link previews.
 *
 * Pure functions tested directly. KV-dependent paths tested with mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock KV storage ───────────────────────────────────────────────

function createMockKV(): Record<string, any> {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    put: vi.fn((key: string, value: string, _opts?: any) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    list: vi.fn((_opts?: any) =>
      Promise.resolve({ keys: Array.from(store.keys()).map((name) => ({ name })) }),
    ),
    _store: store,
  };
}

function createMockEnv(): any {
  return {
    CACHE: createMockKV(),
    CONTENT_LIBRARY: createMockKV(),
    OWNCAST_INSTANCE_URL: 'https://owncast.example.com',
    PEERTUBE_INSTANCE_URL: 'https://peertube.example.com',
  };
}

// ─── Suite 1: Chat Features ────────────────────────────────────────

describe('Chat Features — Reactions', () => {
  it('toggles reaction on/off for a user', async () => {
    const { handleToggleReaction } = await import('../../workers/api/src/routes/chat-features');
    const env = createMockEnv();
    const body = { conversationId: 'conv_1', messageId: 'msg_1', emoji: '🔥' };
    const req = new Request('http://localhost/api/messages/react', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xabc' },
      body: JSON.stringify(body),
    });

    // First call: add reaction
    const res1 = await handleToggleReaction(req, env);
    const data1 = await res1.json();
    expect(data1.ok).toBe(true);
    expect(data1.active).toBe(true);
    expect(data1.count).toBe(1);

    // Second call: remove reaction (same user)
    const res2 = await handleToggleReaction(req, env);
    const data2 = await res2.json();
    expect(data2.ok).toBe(true);
    expect(data2.active).toBe(false);
    expect(data2.count).toBe(0);
  });

  it('returns 400 for missing emoji', async () => {
    const { handleToggleReaction } = await import('../../workers/api/src/routes/chat-features');
    const env = createMockEnv();
    const req = new Request('http://localhost/api/messages/react', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xabc' },
      body: JSON.stringify({ conversationId: 'conv_1', messageId: 'msg_1' }),
    });
    const res = await handleToggleReaction(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing');
  });
});

describe('Chat Features — Edit Message', () => {
  it('edits a message and marks it as edited', async () => {
    const { handleEditMessage } = await import('../../workers/api/src/routes/chat-features');
    const { createMessageMetadata, storeMessageMetadata, getMessageMetadata } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    // Store original message metadata first
    const meta = createMessageMetadata('msg_1', 'conv_1', '0xabc', 'Hello world');
    await storeMessageMetadata(env, meta);

    // Now edit
    const req = new Request('http://localhost/api/messages/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xabc' },
      body: JSON.stringify({ conversationId: 'conv_1', messageId: 'msg_1', content: 'Hello updated!' }),
    });
    const res = await handleEditMessage(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.edited).toBe(true);
    expect(data.editedAt).toBeGreaterThan(0);

    // Verify edit persisted
    const updated = await getMessageMetadata(env, 'msg_1');
    expect(updated).not.toBeNull();
    expect(updated!.currentContent).toBe('Hello updated!');
    expect(updated!.edited).toBe(true);
    expect(updated!.editHistory.length).toBe(1);
  });

  it('rejects edit from non-owner', async () => {
    const { handleEditMessage } = await import('../../workers/api/src/routes/chat-features');
    const { createMessageMetadata, storeMessageMetadata } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const meta = createMessageMetadata('msg_2', 'conv_1', '0xabc', 'Original');
    await storeMessageMetadata(env, meta);

    const req = new Request('http://localhost/api/messages/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xdef' },
      body: JSON.stringify({ conversationId: 'conv_1', messageId: 'msg_2', content: 'Hacked!' }),
    });
    const res = await handleEditMessage(req, env);
    expect(res.status).toBe(404);
  });
});

describe('Chat Features — Unsend (5s window)', () => {
  it('unsends a message within 5 seconds', async () => {
    const { handleUnsendMessage } = await import('../../workers/api/src/routes/chat-features');
    const { isMessageUnsent } = await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const req = new Request('http://localhost/api/messages/unsend', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xabc' },
      body: JSON.stringify({
        messageId: 'msg_1',
        conversationId: 'conv_1',
        createdAt: Date.now(), // within 5s
      }),
    });
    const res = await handleUnsendMessage(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unsent).toBe(true);

    const unsent = await isMessageUnsent(env, 'msg_1', 'conv_1');
    expect(unsent).toBe(true);
  });

  it('rejects unsend after 5 seconds', async () => {
    const { handleUnsendMessage } = await import('../../workers/api/src/routes/chat-features');
    const env = createMockEnv();

    const req = new Request('http://localhost/api/messages/unsend', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wallet-address': '0xabc' },
      body: JSON.stringify({
        messageId: 'msg_2',
        conversationId: 'conv_1',
        createdAt: Date.now() - 10_000, // 10 seconds ago
      }),
    });
    const res = await handleUnsendMessage(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('expired');
  });
});

describe('Chat Features — Delete for Me / Everyone', () => {
  it('deletes a message for me', async () => {
    const { deleteForMe, getDeletedMessageIds } = await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const result = await deleteForMe(env, 'msg_1', '0xabc', 'conv_1');
    expect(result).toBe(true);

    const deleted = await getDeletedMessageIds(env, 'conv_1', '0xabc');
    expect(deleted.has('msg_1')).toBe(true);
  });

  it('deletes a message for everyone within 24h window', async () => {
    const { deleteForEveryone, getDeletedMessageIds, createMessageMetadata, storeMessageMetadata } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const meta = createMessageMetadata('msg_1', 'conv_1', '0xabc', 'Hello');
    await storeMessageMetadata(env, meta);

    const result = await deleteForEveryone(env, 'msg_1', '0xabc', 'conv_1');
    expect(result).toBe(true);

    const deleted = await getDeletedMessageIds(env, 'conv_1', '0xabc');
    expect(deleted.has('msg_1')).toBe(true);
  });

  it('rejects delete-for-everyone after 24h', async () => {
    const { deleteForEveryone, createMessageMetadata, storeMessageMetadata } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const meta = createMessageMetadata('msg_old', 'conv_1', '0xabc', 'Old message');
    // Manually override createdAt to 25h ago
    const oldMeta = { ...meta, createdAt: Date.now() - 25 * 60 * 60 * 1000 };
    await storeMessageMetadata(env, oldMeta);

    await expect(deleteForEveryone(env, 'msg_old', '0xabc', 'conv_1'))
      .rejects.toThrow('expired');
  });
});

describe('Chat Features — Auto-Delete Timer', () => {
  it('sets and retrieves a conversation timer', async () => {
    const { setConversationTimer, getConversationTimer, getTimerDisplayLabel } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    const timer = await setConversationTimer(env, 'conv_1', 3600, '0xabc');
    expect(timer.durationSeconds).toBe(3600);
    expect(timer.label).toBe('1 hr');

    const retrieved = await getConversationTimer(env, 'conv_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.durationSeconds).toBe(3600);

    const label = await getTimerDisplayLabel(env, 'conv_1');
    expect(label).toContain('1 hr');
  });

  it('removes a conversation timer', async () => {
    const { setConversationTimer, removeConversationTimer, getConversationTimer } =
      await import('../../workers/api/src/lib/chat-timers');
    const env = createMockEnv();

    await setConversationTimer(env, 'conv_1', 300, '0xabc');
    await removeConversationTimer(env, 'conv_1');

    const retrieved = await getConversationTimer(env, 'conv_1');
    expect(retrieved).toBeNull();
  });
});

describe('Chat Features — Disappearing Messages', () => {
  it('marks a message as disappearing after read', async () => {
    const { markDisappearing, createMessageMetadata } =
      await import('../../workers/api/src/lib/chat-timers');

    const meta = createMessageMetadata('msg_1', 'conv_1', '0xabc', 'Secret');
    const readAt = Date.now();

    const disappearing = markDisappearing(meta, readAt);
    expect(disappearing.disappearing).toBe(true);
    expect(disappearing.readAt).toBe(readAt);
    expect(disappearing.expiresAt).toBeGreaterThan(readAt);
  });
});

describe('Chat Features — Polls', () => {
  it('creates a poll with options and validates it', async () => {
    const { createPoll, getPoll } = await import('../../workers/api/src/lib/chat-media');
    const env = createMockEnv();

    const poll = await createPoll(env, 'conv_1', '0xabc', 'Best crypto?', ['BTC', 'ETH', 'SOL'], false, 60);
    expect(poll.question).toBe('Best crypto?');
    expect(poll.options).toHaveLength(3);
    expect(poll.multipleChoice).toBe(false);
    expect(poll.endsAt).toBeGreaterThan(Date.now());

    const retrieved = await getPoll(env, poll.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.totalVotes).toBe(0);
  });

  it('rejects poll with fewer than 2 options', async () => {
    const { createPoll } = await import('../../workers/api/src/lib/chat-media');
    const env = createMockEnv();

    await expect(createPoll(env, 'conv_1', '0xabc', 'Bad poll?', ['Only one'], false))
      .rejects.toThrow('2-10');
  });

  it('votes on a poll and tracks results', async () => {
    const { createPoll, votePoll, getPoll } = await import('../../workers/api/src/lib/chat-media');
    const env = createMockEnv();

    const poll = await createPoll(env, 'conv_1', '0xabc', 'Best chain?', ['Solana', 'Ethereum'], false, 60);
    const optionId = poll.options[0]!.id;

    const updated = await votePoll(env, poll.id, '0xuser1', [optionId]);
    expect(updated).not.toBeNull();
    expect(updated!.options[0]!.votes).toBe(1);

    // Verify persisted
    const retrieved = await getPoll(env, poll.id);
    expect(retrieved!.options[0]!.voters).toContain('0xuser1');
  });
});

describe('Chat Features — Media Validation', () => {
  it('validates image size limits', async () => {
    const { validateMediaSize } = await import('../../workers/api/src/lib/chat-media');

    // Small image: allowed
    const small = validateMediaSize(1024 * 1024, 'image/png', false);
    expect(small.allowed).toBe(true);

    // Image over 50MB: rejected
    const big = validateMediaSize(60 * 1024 * 1024, 'image/png', false);
    expect(big.allowed).toBe(false);
    expect(big.reason).toContain('50MB');
  });

  it('validates file size premium upgrade', async () => {
    const { validateMediaSize } = await import('../../workers/api/src/lib/chat-media');

    // Free user over 100MB
    const freeOver = validateMediaSize(150 * 1024 * 1024, 'application/pdf', false);
    expect(freeOver.allowed).toBe(false);
    expect(freeOver.reason).toContain('100MB');

    // Premium user under 2GB
    const premiumOk = validateMediaSize(500 * 1024 * 1024, 'application/pdf', true);
    expect(premiumOk.allowed).toBe(true);
  });
});

describe('Chat Features — Link Preview Extraction', () => {
  it('extracts OG meta tags from HTML', async () => {
    const html = `<!DOCTYPE html>
    <html><head>
      <meta property="og:title" content="Test Article" />
      <meta property="og:description" content="A test article description" />
      <meta property="og:image" content="https://example.com/image.jpg" />
      <meta property="og:site_name" content="Example" />
      <title>Test Article</title>
    </head></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    ));

    const { generateLinkPreview } = await import('../../workers/api/src/lib/chat-media');
    const env = createMockEnv();

    const preview = await generateLinkPreview('https://example.com/article', env);
    expect(preview).not.toBeNull();
    expect(preview!.title).toBe('Test Article');
    expect(preview!.description).toBe('A test article description');
    expect(preview!.imageUrl).toBe('https://example.com/image.jpg');
    expect(preview!.siteName).toBe('Example');

    vi.unstubAllGlobals();
  });

  it('extracts title when OG meta is missing', async () => {
    const html = '<html><head><title>Simple Title</title></head><body>Content</body></html>';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    ));

    const { generateLinkPreview } = await import('../../workers/api/src/lib/chat-media');
    const env = createMockEnv();

    const preview = await generateLinkPreview('https://example.com/page', env);
    expect(preview).not.toBeNull();
    expect(preview!.title).toBe('Simple Title');

    vi.unstubAllGlobals();
  });
});
