// OAuth code exchange handlers
// Each provider requires CLIENT_ID + CLIENT_SECRET in environment

async function notYetImplemented(provider: string) {
  console.warn(`[oauth] ${provider} exchange not yet implemented`);
  return { success: false, reason: 'not_implemented', provider };
}

export async function exchangeRedditCode(code: string, state: string) {
  if (!process.env.REDDIT_CLIENT_ID) return notYetImplemented('reddit');
  return notYetImplemented('reddit');
}
export async function exchangeMediumCode(code: string, state: string) {
  if (!process.env.MEDIUM_CLIENT_ID) return notYetImplemented('medium');
  return notYetImplemented('medium');
}
export async function exchangeGoogleCode(code: string, state: string) {
  if (!process.env.GOOGLE_CLIENT_ID) return notYetImplemented('google');
  return notYetImplemented('google');
}
export async function exchangeLinkedInCode(code: string, state: string) {
  if (!process.env.LINKEDIN_CLIENT_ID) return notYetImplemented('linkedin');
  return notYetImplemented('linkedin');
}
export async function exchangeInstagramCode(code: string, state: string) {
  if (!process.env.INSTAGRAM_CLIENT_ID) return notYetImplemented('instagram');
  return notYetImplemented('instagram');
}
export async function exchangePinterestCode(code: string, state: string) {
  if (!process.env.PINTEREST_CLIENT_ID) return notYetImplemented('pinterest');
  return notYetImplemented('pinterest');
}
export async function exchangeTikTokCode(code: string, state: string) {
  if (!process.env.TIKTOK_CLIENT_ID) return notYetImplemented('tiktok');
  return notYetImplemented('tiktok');
}
