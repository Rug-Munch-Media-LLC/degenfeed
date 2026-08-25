/** Types for the Telegram bot integration module. */

export interface TelegramLinkedUser {
  telegramId: string;
  wallet: string;
  username?: string;
  firstName?: string;
  linkedAt: number;
  preferences: {
    priceAlerts: boolean;
    mentionAlerts: boolean;
    feedAlerts: boolean;
    tipNotifications: boolean;
  };
}

export interface TelegramGroupConfig {
  groupId: string;
  title: string;
  ownerWallet?: string;
  coinSymbol?: string;
  minHoldRequirement?: string;
  feedEnabled: boolean;
  crossPostEnabled: boolean;
  tippingEnabled: boolean;
  tokenGated: boolean;
  connectedAt: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
    date: number;
  };
  callback_query?: {
    id: string;
    from?: { id: number; first_name: string; username?: string };
    message?: { message_id: number; chat?: { id: number } };
    data?: string;
  };
  /** Bot membership change (added to / removed from a chat) */
  my_chat_member?: {
    chat: { id: number; type: string; title?: string; username?: string; first_name?: string };
    from?: { id: number; is_bot: boolean; first_name: string; username?: string };
    new_chat_member: { status: string; user?: { id: number; is_bot: boolean } };
    old_chat_member?: { status: string };
    date?: number;
  };
}
