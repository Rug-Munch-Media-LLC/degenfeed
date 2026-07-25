/** KV key helpers for the Telegram bot module. */

export function telegramUserKey(telegramId: string): string {
  return `telegram:user:${telegramId}`;
}

export function telegramWalletIndex(wallet: string): string {
  return `telegram:wallet:${wallet.toLowerCase()}`;
}

export function telegramGroupKey(groupId: string): string {
  return `telegram:group:${groupId}`;
}

export function telegramGroupFeedKey(groupId: string): string {
  return `telegram:group:feed:${groupId}`;
}

export function telegramCoinGroupKey(symbol: string): string {
  return `telegram:coingroup:${symbol.toLowerCase()}`;
}
