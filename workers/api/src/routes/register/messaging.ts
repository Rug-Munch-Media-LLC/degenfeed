/**
 * @degenfeed/api-worker - Messaging route registration
 *
 * Register Messaging-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import {
  handleInboxActivity,
  handleInboxComments,
  handleInboxDms,
  handleInboxMarkRead as handleInboxMarkReadHandler,
  handleInboxReply,
  handleInboxShare,
  handleInboxStatus,
  handleInboxUnified,
} from '../../lib/universal-inbox';
import { methodNotAllowed } from '../../response-helpers';
import {
  handleBridgeConversation,
  handleBridgeInbox,
  handleBridgeMarkRead,
  handleBridgeResolve,
  handleBridgeSend,
  handleBridgeStatus,
  handleBridgeUnread,
} from '../../routes/bridge';
import {
  handleCreatePoll,
  handleCreateStickerPack,
  handleDeleteFile,
  handleDeleteForMe,
  handleDownloadFile,
  handleEditMessage,
  handleGetFile,
  handleGetMedia,
  handleGetPoll,
  handleGetQuota,
  handleGetStickerPack,
  handleGetStickerPacks,
  handleGetTimer,
  handleLinkPreview,
  handleListFiles,
  handleListMedia,
  handleMarkMessageRead,
  handleRemoveTimer,
  handleSearchGifs,
  handleSetTimer,
  handleToggleReaction,
  handleUnsendMessage,
  handleUploadFile,
  handleUploadMedia,
  handleUploadVoiceNote,
  handleVotePoll,
} from '../../routes/chat-features';
import {
  handleAdvancedSearch,
  handleIndexMessage,
  handleSearchMedia,
  handleSearchMessages,
  handleSearchSuggestions,
} from '../../routes/chat-search';
import {
  handleCreateGroup,
  handleGetOfflineMessages,
  handleGetPublicKeys,
  handleGroupAddMember,
  handleGroupInfo,
  handleGroupMessages,
  handleGroupRemoveMember,
  handleGroupSend,
  handleKeyExchange,
  handleKeyStatus,
  handleReceiveEncrypted,
  handleRotateKeys,
  handleSafetyNumbers,
  handleSendEncrypted,
  handleTransportPrefs,
  handleUserGroups,
} from '../../routes/e2e-messages';
import {
  handleConversationMessages,
  handleConversations,
  handleDeleteMessage,
  handleInbox,
  handleMarkRead,
  handleSendMessage,
  handleThread,
  handleUnreadCount,
} from '../../routes/messages';
import { withSession } from '../../routes/route-registry';

export function registerMessagingRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Messages (DM) ---
  app.get('/api/messages/unread', async (c) => handleUnreadCount(c.req.raw, c.env));
  app.get('/api/messages/conversations', async (c) => handleConversations(c.req.raw, c.env));
  app.get('/api/messages/inbox', async (c) => withSession(c, () => handleInbox(c.req.raw, c.env)));
  app.post('/api/messages/send', async (c) =>
    withSession(c, () => handleSendMessage(c.req.raw, c.env)),
  );
  app.post('/api/messages/read', async (c) =>
    withSession(c, () => handleMarkRead(c.req.raw, c.env)),
  );
  app.get('/api/messages/thread/:peerId', async (c) =>
    withSession(c, () => handleThread(c.req.raw, c.env, c.req.param('peerId'))),
  );
  app.all('/api/messages/:id', async (c) => {
    if (c.req.method === 'GET') {
      return handleConversationMessages(c.req.raw, c.env, c.req.param('id'));
    }
    if (c.req.method === 'DELETE') {
      return handleDeleteMessage(c.req.raw, c.env, c.req.param('id'));
    }
    return methodNotAllowed(['DELETE']);
  });

  // --- API: E2E Encryption & Secure Messaging ---
  app.get('/api/messages/keys/status', async (c) => handleKeyStatus(c.req.raw, c.env));
  app.post('/api/messages/keys/exchange', async (c) =>
    withSession(c, () => handleKeyExchange(c.req.raw, c.env)),
  );
  app.get('/api/messages/keys/public/:userId', async (c) =>
    handleGetPublicKeys(c.req.raw, c.env, c.req.param('userId')),
  );
  app.post('/api/messages/keys/rotate', async (c) =>
    withSession(c, () => handleRotateKeys(c.req.raw, c.env)),
  );
  app.post('/api/messages/keys/safety-numbers', async (c) =>
    withSession(c, () => handleSafetyNumbers(c.req.raw, c.env)),
  );
  app.post('/api/messages/send-encrypted', async (c) =>
    withSession(c, () => handleSendEncrypted(c.req.raw, c.env)),
  );
  app.post('/api/messages/receive-encrypted', async (c) =>
    withSession(c, () => handleReceiveEncrypted(c.req.raw, c.env)),
  );

  // --- API: Encrypted Group Chat ---
  app.post('/api/messages/groups/create', async (c) =>
    withSession(c, () => handleCreateGroup(c.req.raw, c.env)),
  );
  app.get('/api/messages/groups/list', async (c) =>
    withSession(c, () => handleUserGroups(c.req.raw, c.env)),
  );
  app.get('/api/messages/groups/:groupId/info', async (c) =>
    withSession(c, () => handleGroupInfo(c.req.raw, c.env, c.req.param('groupId'))),
  );
  app.post('/api/messages/groups/:groupId/send', async (c) =>
    withSession(c, () => handleGroupSend(c.req.raw, c.env, c.req.param('groupId'))),
  );
  app.get('/api/messages/groups/:groupId/messages', async (c) =>
    withSession(c, () => handleGroupMessages(c.req.raw, c.env, c.req.param('groupId'))),
  );
  app.post('/api/messages/groups/:groupId/add-member', async (c) =>
    withSession(c, () => handleGroupAddMember(c.req.raw, c.env, c.req.param('groupId'))),
  );
  app.post('/api/messages/groups/:groupId/remove-member', async (c) =>
    withSession(c, () => handleGroupRemoveMember(c.req.raw, c.env, c.req.param('groupId'))),
  );

  // --- API: Chat Search ---
  app.get('/api/messages/search', async (c) =>
    withSession(c, () => handleSearchMessages(c.req.raw, c.env)),
  );
  app.get('/api/messages/search/advanced', async (c) =>
    withSession(c, () => handleAdvancedSearch(c.req.raw, c.env)),
  );
  app.get('/api/messages/search/media/:conversationId', async (c) =>
    withSession(c, () => handleSearchMedia(c.req.raw, c.env, c.req.param('conversationId'))),
  );
  app.post('/api/messages/search/index', async (c) =>
    withSession(c, () => handleIndexMessage(c.req.raw, c.env)),
  );
  app.get('/api/messages/search/suggestions', async (c) =>
    withSession(c, () => handleSearchSuggestions(c.req.raw, c.env)),
  );

  // --- API: Enhanced Chat Features (Reactions, Edit, Timers, Media, Polls, GIFs) ---
  app.post('/api/messages/react', async (c) =>
    withSession(c, () => handleToggleReaction(c.req.raw, c.env)),
  );
  app.post('/api/messages/edit', async (c) =>
    withSession(c, () => handleEditMessage(c.req.raw, c.env)),
  );
  app.post('/api/messages/unsend', async (c) =>
    withSession(c, () => handleUnsendMessage(c.req.raw, c.env)),
  );
  app.post('/api/messages/delete-for-me', async (c) =>
    withSession(c, () => handleDeleteForMe(c.req.raw, c.env)),
  );
  app.post('/api/messages/mark-read/:messageId', async (c) =>
    withSession(c, () => handleMarkMessageRead(c.req.raw, c.env, c.req.param('messageId'))),
  );

  // --- API: Conversation Timers (Auto-Delete) ---
  app.get('/api/chat/timer/:conversationId', async (c) =>
    withSession(c, () => handleGetTimer(c.req.raw, c.env, c.req.param('conversationId'))),
  );
  app.post('/api/chat/timer/:conversationId', async (c) =>
    withSession(c, () => handleSetTimer(c.req.raw, c.env, c.req.param('conversationId'))),
  );
  app.delete('/api/chat/timer/:conversationId', async (c) =>
    withSession(c, () => handleRemoveTimer(c.req.raw, c.env, c.req.param('conversationId'))),
  );

  // --- API: Chat Media ---
  app.post('/api/chat/media/upload', async (c) =>
    withSession(c, () => handleUploadMedia(c.req.raw, c.env)),
  );
  app.get('/api/chat/media/:mediaId', async (c) =>
    handleGetMedia(c.req.raw, c.env, c.req.param('mediaId')),
  );
  app.get('/api/chat/media/list/:conversationId', async (c) =>
    withSession(c, () => handleListMedia(c.req.raw, c.env, c.req.param('conversationId'))),
  );

  // --- API: Polls ---
  app.post('/api/chat/polls/create', async (c) =>
    withSession(c, () => handleCreatePoll(c.req.raw, c.env)),
  );
  app.post('/api/chat/polls/vote', async (c) =>
    withSession(c, () => handleVotePoll(c.req.raw, c.env)),
  );
  app.get('/api/chat/polls/:pollId', async (c) =>
    handleGetPoll(c.req.raw, c.env, c.req.param('pollId')),
  );

  // --- API: GIF Search ---
  app.get('/api/chat/gifs/search', async (c) =>
    withSession(c, () => handleSearchGifs(c.req.raw, c.env)),
  );

  // --- API: Link Previews ---
  app.post('/api/chat/link-preview', async (c) =>
    withSession(c, () => handleLinkPreview(c.req.raw, c.env)),
  );

  // --- API: File Upload & Management ---
  app.post('/api/chat/files/upload', async (c) =>
    withSession(c, () => handleUploadFile(c.req.raw, c.env)),
  );
  app.get('/api/chat/files/:fileId', async (c) =>
    handleGetFile(c.req.raw, c.env, c.req.param('fileId')),
  );
  app.get('/api/chat/files/download/:fileId', async (c) =>
    withSession(c, () => handleDownloadFile(c.req.raw, c.env, c.req.param('fileId'))),
  );
  app.get('/api/chat/files/list/:conversationId', async (c) =>
    withSession(c, () => handleListFiles(c.req.raw, c.env, c.req.param('conversationId'))),
  );
  app.delete('/api/chat/files/:fileId', async (c) =>
    withSession(c, () => handleDeleteFile(c.req.raw, c.env, c.req.param('fileId'))),
  );
  app.get('/api/chat/quota', async (c) => withSession(c, () => handleGetQuota(c.req.raw, c.env)));

  // --- API: Stickers ---
  app.post('/api/chat/stickers/create-pack', async (c) =>
    withSession(c, () => handleCreateStickerPack(c.req.raw, c.env)),
  );
  app.get('/api/chat/stickers/packs', async (c) =>
    withSession(c, () => handleGetStickerPacks(c.req.raw, c.env)),
  );
  app.get('/api/chat/stickers/pack/:packId', async (c) =>
    handleGetStickerPack(c.req.raw, c.env, c.req.param('packId')),
  );

  // --- API: Voice Notes ---
  app.post('/api/messages/voice/upload', async (c) =>
    withSession(c, () => handleUploadVoiceNote(c.req.raw, c.env)),
  );

  // --- API: Transport Preferences ---
  app.all('/api/messages/transport/preferences', async (c) =>
    withSession(c, () => handleTransportPrefs(c.req.raw, c.env)),
  );
  app.get('/api/messages/transport/offline', async (c) =>
    withSession(c, () => handleGetOfflineMessages(c.req.raw, c.env)),
  );

  // --- API: Universal Inbox (Cross-Network Communication Bridge) ---
  app.get('/api/inbox/unified', async (c) =>
    withSession(c, () => handleInboxUnified(c.req.raw, c.env)),
  );
  app.get('/api/inbox/dms', async (c) => withSession(c, () => handleInboxDms(c.req.raw, c.env)));
  app.get('/api/inbox/comments', async (c) =>
    withSession(c, () => handleInboxComments(c.req.raw, c.env)),
  );
  app.get('/api/inbox/activity', async (c) =>
    withSession(c, () => handleInboxActivity(c.req.raw, c.env)),
  );
  app.post('/api/inbox/reply', async (c) =>
    withSession(c, () => handleInboxReply(c.req.raw, c.env)),
  );
  app.post('/api/inbox/mark-read', async (c) =>
    withSession(c, () => handleInboxMarkReadHandler(c.req.raw, c.env)),
  );
  app.get('/api/inbox/status', async (c) =>
    withSession(c, () => handleInboxStatus(c.req.raw, c.env)),
  );
  app.post('/api/inbox/share', async (c) =>
    withSession(c, () => handleInboxShare(c.req.raw, c.env)),
  );

  // --- API: Cross-Protocol DM Bridge (Universal DM + INBOX) ---
  app.post('/api/bridge/send', async (c) =>
    withSession(c, () => handleBridgeSend(c.req.raw, c.env)),
  );
  app.get('/api/bridge/inbox', async (c) =>
    withSession(c, () => handleBridgeInbox(c.req.raw, c.env)),
  );
  app.get('/api/bridge/inbox/:peerId', async (c) =>
    withSession(c, () => handleBridgeConversation(c.req.raw, c.env, c.req.param('peerId'))),
  );
  app.post('/api/bridge/read', async (c) =>
    withSession(c, () => handleBridgeMarkRead(c.req.raw, c.env)),
  );
  app.get('/api/bridge/status', async (c) =>
    withSession(c, () => handleBridgeStatus(c.req.raw, c.env)),
  );
  app.get('/api/bridge/unread', async (c) =>
    withSession(c, () => handleBridgeUnread(c.req.raw, c.env)),
  );
  app.get('/api/bridge/resolve/:identifier', async (c) =>
    withSession(c, () => handleBridgeResolve(c.req.raw, c.env, c.req.param('identifier'))),
  );
}
