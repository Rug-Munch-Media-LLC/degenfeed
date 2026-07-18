import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

const CHAIN_FOR_METHOD: Record<string, { chain: string; chainId: number }> = {
  ethereum: { chain: 'ethereum', chainId: 1 },
  base: { chain: 'base', chainId: 8453 },
  optimism: { chain: 'optimism', chainId: 10 },
  arbitrum: { chain: 'arbitrum', chainId: 42161 },
  solana: { chain: 'solana', chainId: 0 },
  lightning_zap: { chain: 'lightning', chainId: 0 },
  lens_collect: { chain: 'polygon', chainId: 137 },
  onchain_tip: { chain: 'base', chainId: 8453 },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipient, recipientProtocol, method, amount, publicationId } = body;

    if (!recipient || !method || !amount) {
      return NextResponse.json({ error: 'Missing required fields: recipient, method, amount' }, { status: 400 });
    }

    const chainInfo = CHAIN_FOR_METHOD[method] || { chain: 'ethereum', chainId: 1 };
    const amountInWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18)).toString(16);

    const intent = {
      to: recipient,
      amount,
      chain: chainInfo.chain,
      chainId: chainInfo.chainId,
      value: `0x${amountInWei}`,
      data: publicationId ? `0x${Buffer.from(publicationId).toString('hex')}` : '0x',
      from: body.from || '',
      note: `Tip from DegenFeed${body.recipient ? ` for ${recipient}` : ''}`,
      actionUrl: chainInfo.chainId !== 0 ? `https://app.degenfeed.xyz/tip/${method}/${recipient}` : undefined,
      zapEndpoint: method === 'lightning_zap' ? `lnurlp://app.degenfeed.xyz/.well-known/lnurlp/${recipient}` : undefined,
    };

    return NextResponse.json({
      intent,
      instructions: method === 'ethereum'
        ? 'Send ETH to the address above. Gas fees apply on Ethereum mainnet.'
        : method === 'solana'
          ? 'Send SOL to the address above via the Solana network.'
          : `Send on ${chainInfo.chain} network.`,
      actionUrl: intent.actionUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
