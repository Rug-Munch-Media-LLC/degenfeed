export function getHandleTier(length: number): {
  label: string;
  price: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'muted';
} {
  if (length === 0) return { label: 'Type a handle to see price', price: '—', color: 'muted' };
  if (length >= 9) return { label: 'Standard (included)', price: '$0', color: 'green' };
  if (length >= 7) return { label: 'Short handle', price: '+$5–8', color: 'yellow' };
  if (length >= 5) return { label: 'Premium short', price: '+$15–25', color: 'orange' };
  return { label: 'Ultra short (premium)', price: '+$30–50', color: 'red' };
}

export function getLensHandleGasCost(handle: string): number {
  const len = handle.trim().length;
  if (len === 0) return 0;
  if (len >= 9) return 2;
  if (len >= 7) return 7;
  if (len >= 5) return 20;
  return 40;
}
