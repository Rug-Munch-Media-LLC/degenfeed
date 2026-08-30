import { type NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tip/lightning/invoice
 *
 * NOT IMPLEMENTED — honest fence.
 *
 * This route previously returned a randomly-generated fake "lnbc…" string that
 * could never be settled. Real Lightning invoices require a Lightning node or
 * LNURL provider (e.g. a hosted LNbits/Alby/Strike integration) that can
 * actually accept payment. Until one is wired up, this endpoint refuses
 * instead of pretending.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Lightning invoicing is not implemented — no Lightning node/LNURL provider is configured. This endpoint previously returned fake invoices that could not be paid.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
