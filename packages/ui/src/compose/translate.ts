'use client';

/**
 * @degenfeed/ui — ask the host to shorten a draft for a smaller protocol.
 */

export async function requestTranslation(
  text: string,
  toProtocol: string,
  fromProtocol = 'lens',
): Promise<string | null> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text, fromProtocol, toProtocol }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translated?: string };
    return data.translated ?? null;
  } catch {
    return null;
  }
}
