import type { PlatformRegistration, RegisterOptions } from './types';

const FARCASTER_REGISTRATION_AMOUNT = '5000000000000000000';
const BASE_CHAIN_ID = 8453;

export async function registerFarcaster(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const hubUrl = 'https://hub.farcaster.standardcrypto.vc:2281';
    const checkRes = await fetch(
      `${hubUrl}/v1/userNameProofByName?name=${encodeURIComponent(desiredUsername)}`,
      { headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' } },
    );
    if (checkRes.ok) {
      const existing = (await checkRes.json()) as { fid?: number; name?: string };
      if (existing.fid)
        return {
          platform: 'farcaster',
          status: 'failed',
          error: `Username @${desiredUsername} is already taken`,
        };
    }
    const idRegistryAddress = '0x00000000fc6c5f01fc30151999387bb99a9f489b';
    const recoveryAddress = walletAddress;
    const registerData = encodeRegisterCall(recoveryAddress, desiredUsername);
    const { txHash } = await sendBaseTransaction(
      idRegistryAddress,
      registerData,
      FARCASTER_REGISTRATION_AMOUNT,
      opts,
    );
    const fid = await waitForFarcasterRegistration(txHash, walletAddress);
    const accountInfo: Record<string, string> = {
      fid: String(fid),
      username: desiredUsername,
      recoveryAddress,
      txHash,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('farcaster', walletAddress, accountInfo, opts.storage);
    return {
      platform: 'farcaster',
      status: 'created',
      username: desiredUsername,
      txHash,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'farcaster',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Farcaster registration error',
    };
  }
}

function encodeRegisterCall(recovery: string, _username: string): string {
  const recoveryPadded = recovery.toLowerCase().replace('0x', '').padStart(64, '0');
  return `0x4420e486${recoveryPadded}0000000000000000000000000000000000000000000000000000000000000000`;
}

async function sendBaseTransaction(
  to: string,
  data: string,
  value: string,
  opts: RegisterOptions,
): Promise<{ txHash: string }> {
  const rpcUrl = opts.baseRpcUrl || 'https://mainnet.base.org';
  const pk = opts.premiumWalletPrivateKey;
  if (!pk) throw new Error('Premium wallet private key not configured');
  const { privateKeyToAddress, signTransaction } = await import('../evm-utils');
  const fromAddress = privateKeyToAddress(pk);
  const nonceRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionCount',
      params: [fromAddress, 'pending'],
    }),
  });
  const nonceData = (await nonceRes.json()) as { result: string };
  const gasPriceRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }),
  });
  const gasPriceData = (await gasPriceRes.json()) as { result: string };
  const gasEstimateRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'eth_estimateGas',
      params: [{ from: fromAddress, to, data, value }],
    }),
  });
  const gasEstimateData = (await gasEstimateRes.json()) as { result: string };
  const tx = {
    to,
    data,
    value,
    gas: gasEstimateData.result,
    gasPrice: gasPriceData.result,
    nonce: nonceData.result,
    chainId: BASE_CHAIN_ID,
  } as import('../evm-utils').TransactionRequest;
  const signedTx = signTransaction(tx, pk);
  const sendRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    }),
  });
  const sendData = (await sendRes.json()) as { result?: string; error?: { message: string } };
  if (sendData.error) throw new Error(`Base transaction failed: ${sendData.error.message}`);
  if (!sendData.result) throw new Error('Base transaction missing tx hash');
  return { txHash: sendData.result };
}

async function waitForFarcasterRegistration(
  txHash: string,
  _walletAddress: string,
): Promise<number> {
  const rpcUrl = 'https://mainnet.base.org';
  for (let i = 0; i < 30; i++) {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });
    const data = (await res.json()) as {
      result?: { status: string; logs: Array<{ data: string }> };
    };
    if (data.result) {
      if (data.result.status === '0x1') {
        const log = data.result.logs.find((l) => l.data && l.data.length >= 66);
        return log ? Number.parseInt(log.data.slice(0, 66), 16) : 0;
      }
      throw new Error('Farcaster registration transaction reverted');
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for Farcaster registration confirmation');
}
