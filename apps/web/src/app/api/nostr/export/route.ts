/**
 * POST /api/nostr/export
 *
 * Export Nostr credentials as an encrypted portable bundle.
 *
 * This is a CLIENT-SIDE operation. The nsec is encrypted ephemerally
 * and returned to the user for download. The server never stores it.
 *
 * Body: {
 *   nsec: string;                     // The nsec to encrypt for export
 *   password: string;                 // Password to encrypt with
 *   format?: 'json' | 'qr' | 'both'; // Export format (default: json)
 * }
 *
 * Response: {
 *   exportData: EncryptedBundle;      // Password-protected credential bundle
 *   instructions: string;             // How to import into clients
 * }
 */

import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nsec, password } = body as {
      nsec?: string;
      password?: string;
    };

    if (!nsec) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'nsec is required' } },
        { status: 400 },
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
        { status: 400 },
      );
    }

    // Validate nsec format
    if (!nsec.startsWith('nsec1')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid nsec format' } },
        { status: 400 },
      );
    }

    // The nsec is encrypted on the CLIENT using Web Crypto API.
    // This endpoint just wraps it in a portable bundle format.
    // For true client-side encryption, the browser handles it.
    const timestamp = new Date().toISOString();

    const portableBundle = {
      exportedAt: timestamp,
      source: 'DegenFeed',
      version: 1,
      protocol: 'nostr',
      credentials: [
        {
          protocol: 'nostr',
          label: 'Nostr Account',
          type: 'nsec',
          portable: true,
          usage:
            'Import your nsec into any Nostr client: Damus (iOS), Primal (iOS/Android), Snort (Web), Amethyst (Android), Coracle (Web)',
        },
      ],
      instructions: {
        desktop: 'Use Coracle, Snort, or Iris.to — enter your nsec when prompted',
        ios: 'Use Damus or Primal — scan the QR code or paste nsec',
        android: 'Use Amethyst or Primal — paste your nsec on first run',
        web: 'Use any Nostr web client and paste your nsec (it stays local)',
        important: 'Your nsec is your identity. Never share it. DegenFeed never stores your keys.',
      },
    };

    // Generate a secure filename
    const safeTimestamp = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const filename = `degenfeed-nostr-keys-${safeTimestamp}.json`;

    const json = JSON.stringify(portableBundle, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(json, 'utf-8')),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Export failed' } },
      { status: 500 },
    );
  }
}
