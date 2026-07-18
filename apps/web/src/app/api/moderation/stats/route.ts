import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
export async function GET() {
  return NextResponse.json({
    stats: {
      total: 47,
      pending: 6,
      resolved: 28,
      dismissed: 13,
      today: 3,
      week: 18,
      month: 47,
      resolutionRate: 87,
      activeBans: 4,
    },
    topReporters: [
      { address: '0x742d35Cc6634C0532925a3b844Bc4a1b8f1c8a1b', count: 12 },
      { address: '0x8fC6e7E8F9AaB3D5c6D7E8F9AaB3D5c6D7E8F9A', count: 8 },
      { address: '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B', count: 5 },
      { address: '0xbCd8E9fAaB3D5c6D7E8F9AaB3D5c6D7E8F9AaB3', count: 4 },
      { address: '0xc6D7E8F9AaB3D5c6D7E8F9AaB3D5c6D7E8F9AaB3', count: 3 },
    ],
    mostReported: [
      { userId: '0x1234567890abcdef1234567890abcdef12345678', count: 7 },
      { userId: 'npub1spamuser00000000000000000000000000000000', count: 5 },
      { userId: '0xabcdef1234567890abcdef1234567890abcdef12', count: 4 },
      { userId: 'did:key:z6Mkscammer123456789abcdef1234567890abc', count: 3 },
    ],
  });
}
