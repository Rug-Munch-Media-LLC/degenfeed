# @degenfeed/telegram-sdk

Telegram Bot API client for DegenFeed. Post content to Telegram channels,
manage chat membership, link identities, and format content for Telegram's
messaging platform.

Uses `fetch()` throughout — compatible with **Cloudflare Workers**, **Node 18+**,
and browser environments. No heavy dependencies.

## Installation

```bash
pnpm add @degenfeed/telegram-sdk
```

## Getting a Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather).
2. Send `/newbot` and follow the prompts.
3. Copy the bot token (looks like `1234567890:ABCdefGHIjklmNOPqrSTUvwxYZ`).
4. **Add the bot as admin** to your channel for posting:
   - Channel info → Administrators → Add Admin → search your bot → grant permissions.

## Quick Start

```typescript
import { TGBotClient } from '@degenfeed/telegram-sdk';

const bot = new TGBotClient('YOUR_BOT_TOKEN');

// Send a simple text message
const result = await bot.sendMessage('@yourchannel', 'Hello from DegenFeed!', {
  parseMode: 'HTML',
});
console.log(`Sent message #${result.messageId}`);

// Send a photo with caption
await bot.sendPhoto('@yourchannel', 'https://example.com/image.jpg', {
  caption: '<b>Check this out!</b>',
  parseMode: 'HTML',
});
```

## Usage

### Posting Content

```typescript
// Text messages with formatting
await bot.sendMessage('@channel', '<b>Bold</b> <i>italic</i> <code>code</code>', {
  parseMode: 'HTML',
  disableWebPagePreview: true,
});

// Reply to a specific message
await bot.sendMessage('@channel', 'Replying to you!', {
  replyToMessageId: 42,
});

// Video with streaming support
await bot.sendVideo('@channel', 'https://example.com/video.mp4', {
  caption: 'Amazing video',
  duration: 120,
  supportsStreaming: true,
});

// Media group (album) — up to 10 items
await bot.sendMediaGroup('@channel', [
  { type: 'photo', media: 'https://example.com/1.jpg' },
  { type: 'photo', media: 'https://example.com/2.jpg', caption: 'Second image' },
  { type: 'video', media: 'https://example.com/vid.mp4' },
]);
```

### Editing & Deleting

```typescript
// Edit a message
await bot.editMessageText('@channel', 42, 'Updated text', {
  parseMode: 'HTML',
});

// Delete a message
await bot.deleteMessage('@channel', 42);
```

### Channel Management

```typescript
// Get chat info
const chat = await bot.getChat('@channel');
console.log(chat.title, chat.type, chat.username);

// Check member count
const count = await bot.getChatMemberCount('@channel');

// Get bot info
const me = await bot.getMe();
console.log(`I'm @${me.username}`);

// Pin a message
await bot.pinMessage('@channel', 42, { disableNotification: true });
```

### Identity Verification

```typescript
// Check if a user is a member of your channel
const isMember = await bot.verifyMembership('@private-channel', userId);

// Check if the bot itself is in a chat
const isBotInChat = await bot.verifyBotMembership('@some-chat');
```

### Webhook Setup

```typescript
// Set up a webhook to receive updates
await bot.setWebhook('https://your-server.com/webhook', {
  secretToken: 'your-secret',
});

// Check webhook status
const info = await bot.getWebhookInfo();

// Remove webhook
await bot.deleteWebhook();
```

### Formatting Content

```typescript
import { formatForTelegram, stripUnsupportedTags, buildTelegramContent } from '@degenfeed/telegram-sdk';

// Truncate to 4096 chars, closing open tags
const safe = formatForTelegram(longHtmlContent, { parseMode: 'HTML' });

// Strip tags Telegram doesn't support
const clean = stripUnsupportedTags('<div><b>OK</b><script>bad</script></div>', 'HTML');
// Result: '<b>OK</b>'

// Build a complete Telegram-ready content string
const content = buildTelegramContent('<b>Post</b> from DegenFeed!');
```

### Media Upload Helpers

```typescript
import { uploadPhoto, uploadMediaGroup, uploadVideo } from '@degenfeed/telegram-sdk';

// Upload a single photo
const { ok, messageId, error } = await uploadPhoto(bot, '@channel', 'https://...');

// Upload an album
const album = await uploadMediaGroup(bot, '@channel', [
  'https://example.com/1.jpg',
  'https://example.com/2.jpg',
]);

// Upload a video
const video = await uploadVideo(bot, '@channel', 'https://example.com/video.mp4', {
  caption: 'My video',
  duration: 60,
});
```

## Error Handling

The SDK throws typed errors for API failures:

```typescript
import { TGBotClient, TelegramError, TelegramRateLimitError } from '@degenfeed/telegram-sdk';

try {
  await bot.sendMessage('@channel', 'Hello');
} catch (err) {
  if (err instanceof TelegramRateLimitError) {
    console.log(`Rate limited, retry after ${err.retryAfter}s`);
  } else if (err instanceof TelegramError) {
    console.log(`Telegram error ${err.errorCode}: ${err.message}`);
  }
}
```

## Rate Limiting

The SDK includes built-in rate limiting (~30 messages/second by default).
If the Telegram API responds with a `429` error, the client will
automatically retry up to 3 times with exponential backoff.

```typescript
// Configure custom rate limit
const bot = new TGBotClient('token', { rateLimitRps: 20 });
```

## API

### `TGBotClient`

| Method | Description |
|--------|-------------|
| `sendMessage` | Send a text message |
| `sendPhoto` | Send a photo (URL, file_id, or Buffer) |
| `sendVideo` | Send a video (URL, file_id, or Buffer) |
| `sendMediaGroup` | Send an album (up to 10 items) |
| `editMessageText` | Edit a message's text |
| `deleteMessage` | Delete a message |
| `getChat` | Get chat information |
| `getChatMember` | Get chat member info |
| `getChatMemberCount` | Get member count |
| `getMe` | Get bot info |
| `pinMessage` | Pin a message |
| `unpinMessage` | Unpin a message |
| `leaveChat` | Leave a chat |
| `verifyMembership` | Check user membership |
| `verifyBotMembership` | Check bot membership |
| `setWebhook` | Set webhook URL |
| `deleteWebhook` | Remove webhook |
| `getWebhookInfo` | Get webhook status |
| `getFile` | Get file metadata |
| `getFileUrl` | Get file download URL |

### Formatting Helpers

| Function | Description |
|----------|-------------|
| `formatForTelegram` | Truncate to 4096 chars, close open tags |
| `stripUnsupportedTags` | Remove tags Telegram doesn't support |
| `escapeMarkdownV2` | Escape special chars for MarkdownV2 |
| `escapeHtml` | Escape HTML entities |
| `buildTelegramContent` | Full pipeline: strip + escape + truncate |

### Media Helpers

| Function | Description |
|----------|-------------|
| `uploadPhoto` | Convenience wrapper for sending a photo |
| `uploadVideo` | Convenience wrapper for sending a video |
| `uploadMediaGroup` | Convenience wrapper for sending an album |

## TypeScript

The SDK is written in TypeScript with full type definitions exported:

```typescript
import type {
  TgChat, TgChatMember, TgMessage, TgUser,
  TgInputMedia, TgInlineKeyboardMarkup,
} from '@degenfeed/telegram-sdk';
```
