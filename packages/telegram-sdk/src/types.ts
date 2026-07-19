/**
 * Telegram Bot API response types used by @degenfeed/telegram-sdk.
 * Covers the subset of the Bot API that DegenFeed interacts with.
 */

// ─── API Response Envelope ─────────────────────────────────────────

export interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

// ─── Chat ──────────────────────────────────────────────────────────

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  invite_link?: string;
  photo?: TgChatPhoto;
  active_usernames?: string[];
  /** @deprecated Use active_usernames instead */
  has_private_forwards?: boolean;
  /** @deprecated Use active_usernames instead */
  has_restricted_voice_and_video_messages?: boolean;
  join_to_send_messages?: boolean;
  join_by_request?: boolean;
  linked_chat_id?: number;
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  has_protected_content?: boolean;
  has_visible_history?: boolean;
  can_set_sticker_set?: boolean;
  sticker_set_name?: string;
  /** True if users need to join the supergroup before they can send messages */
  is_forum?: boolean;
}

export interface TgChatPhoto {
  small_file_id: string;
  small_file_unique_id: string;
  big_file_id: string;
  big_file_unique_id: string;
}

// ─── User ──────────────────────────────────────────────────────────

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

// ─── Message ───────────────────────────────────────────────────────

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  sender_chat?: TgChat;
  date: number;
  chat: TgChat;
  text?: string;
  caption?: string;
  entities?: TgMessageEntity[];
  caption_entities?: TgMessageEntity[];
  reply_to_message?: TgMessage;
  via_bot?: TgUser;
  edit_date?: number;
  media_group_id?: string;
  photo?: TgPhotoSize[];
  video?: TgVideo;
  document?: TgDocument;
  animation?: TgAnimation;
  audio?: TgAudio;
  voice?: TgVoice;
  sticker?: TgSticker;
  poll?: TgPoll;
  reply_markup?: TgInlineKeyboardMarkup;
  is_topic_message?: boolean;
  message_thread_id?: number;
  forum_topic_created?: Record<string, unknown>;
  /** Service message: a user was removed from the chat */
  left_chat_member?: TgUser;
  /** Service message: a user was added to the chat */
  new_chat_members?: TgUser[];
  /** Service message: the chat photo was changed */
  new_chat_photo?: TgPhotoSize[];
}

// ─── Message Entity ────────────────────────────────────────────────

export interface TgMessageEntity {
  type:
    | 'mention'
    | 'hashtag'
    | 'cashtag'
    | 'bot_command'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'spoiler'
    | 'blockquote'
    | 'code'
    | 'pre'
    | 'text_link'
    | 'text_mention'
    | 'custom_emoji';
  offset: number;
  length: number;
  url?: string;
  user?: TgUser;
  language?: string;
  custom_emoji_id?: string;
}

// ─── Chat Member ───────────────────────────────────────────────────

export interface TgChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: TgUser;
  is_anonymous?: boolean;
  custom_title?: string;
  until_date?: number;
  can_be_edited?: boolean;
  can_manage_chat?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
  can_restrict_members?: boolean;
  can_promote_members?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  is_member?: boolean;
  can_send_messages?: boolean;
  can_send_audios?: boolean;
  can_send_documents?: boolean;
  can_send_photos?: boolean;
  can_send_videos?: boolean;
  can_send_video_notes?: boolean;
  can_send_voice_notes?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
}

// ─── Media Types ───────────────────────────────────────────────────

export interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TgVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: TgPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TgDocument {
  file_id: string;
  file_unique_id: string;
  thumbnail?: TgPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TgAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: TgPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TgAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TgPhotoSize;
}

export interface TgVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TgSticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  emoji?: string;
  set_name?: string;
  thumbnail?: TgPhotoSize;
  file_size?: number;
}

export interface TgPoll {
  id: string;
  question: string;
  options: { text: string; voter_count: number }[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: 'regular' | 'quiz';
  allows_multiple_answers: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_entities?: TgMessageEntity[];
  open_period?: number;
  close_date?: number;
}

// ─── Webhook ───────────────────────────────────────────────────────

export interface TgWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

// ─── Keyboard Markup ───────────────────────────────────────────────

export interface TgInlineKeyboardMarkup {
  inline_keyboard: TgInlineKeyboardButton[][];
}

export interface TgInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
  login_url?: { url: string };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: Record<string, unknown>;
  pay?: boolean;
}

export interface TgReplyKeyboardMarkup {
  keyboard: TgKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface TgKeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  web_app?: { url: string };
}

export interface TgReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export interface TgForceReply {
  force_reply: true;
  input_field_placeholder?: string;
  selective?: boolean;
}

// ─── Input Media ───────────────────────────────────────────────────

export interface TgInputMediaPhoto {
  type: 'photo';
  media: string;
  caption?: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  caption_entities?: TgMessageEntity[];
  has_spoiler?: boolean;
}

export interface TgInputMediaVideo {
  type: 'video';
  media: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  caption_entities?: TgMessageEntity[];
  width?: number;
  height?: number;
  duration?: number;
  supports_streaming?: boolean;
  has_spoiler?: boolean;
}

export type TgInputMedia = TgInputMediaPhoto | TgInputMediaVideo;

// ─── File ──────────────────────────────────────────────────────────

export interface TgFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}
