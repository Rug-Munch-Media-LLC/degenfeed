import type { Env } from '../types';
import { getAllCommunityMembers, getCommunityById } from './feddy-community';
import { getStore, k } from './feddy-constants';
import type {
  BotApiKey,
  CommunityTokenConfig,
  FederationHealth,
  RemoteCommunity,
  TokenGate,
  TreasuryState,
  TreasuryTx,
  WebhookConfig,
} from './feddy-types';

export async function setTreasury(env: Env, state: TreasuryState): Promise<void> {
  await getStore(env).put(k('feddy', 'treasury', state.communityId), JSON.stringify(state));
}

export async function getTreasury(env: Env, communityId: string): Promise<TreasuryState | null> {
  try {
    const raw = await getStore(env).get(k('feddy', 'treasury', communityId));
    return raw ? (JSON.parse(raw) as TreasuryState) : null;
  } catch {
    return null;
  }
}

export async function addTreasuryTx(env: Env, tx: TreasuryTx): Promise<void> {
  const key = k('feddy', 'treasury-tx', tx.communityId, tx.id);
  await getStore(env).put(key, JSON.stringify(tx));
}

export async function getTreasuryTxs(
  env: Env,
  communityId: string,
  limit = 20,
): Promise<TreasuryTx[]> {
  try {
    // Scan for transactions — in production use proper cursor-based approach
    const store = getStore(env);
    const _prefix = k('feddy', 'treasury-tx', communityId);
    // KV list is not available in all Workers runtimes; use a simple index
    const indexKey = k('feddy', 'treasury-tx-index', communityId);
    const raw = await store.get(indexKey);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    const txs: TreasuryTx[] = [];
    for (const id of ids.slice(0, limit)) {
      const txRaw = await store.get(k('feddy', 'treasury-tx', communityId, id));
      if (txRaw) txs.push(JSON.parse(txRaw) as TreasuryTx);
    }
    return txs.reverse();
  } catch {
    return [];
  }
}

// ─── Community Token ───────────────────────────────────────────────────

export async function setTokenConfig(env: Env, config: CommunityTokenConfig): Promise<void> {
  const store = getStore(env);
  await store.put(k('feddy', 'token-config', config.communityId), JSON.stringify(config));

  // Also update community record
  const community = await getCommunityById(env, config.communityId);
  if (community) {
    community.communityTokenMint = config.mintAddress;
    community.communityTokenSymbol = config.symbol;
    community.totalTokenSupply = config.totalSupply;
    await store.put(k('feddy', community.id), JSON.stringify(community));
  }
}

export async function getTokenConfig(
  env: Env,
  communityId: string,
): Promise<CommunityTokenConfig | null> {
  try {
    const raw = await getStore(env).get(k('feddy', 'token-config', communityId));
    return raw ? (JSON.parse(raw) as CommunityTokenConfig) : null;
  } catch {
    return null;
  }
}

// ─── Token Gates ───────────────────────────────────────────────────────

export async function setTokenGates(
  env: Env,
  communityId: string,
  gates: TokenGate[],
): Promise<void> {
  await getStore(env).put(k('feddy', 'token-gates', communityId), JSON.stringify(gates));
}

export async function getTokenGates(env: Env, communityId: string): Promise<TokenGate[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'token-gates', communityId));
    return raw ? (JSON.parse(raw) as TokenGate[]) : [];
  } catch {
    return [];
  }
}

export async function checkTokenGate(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<{
  passed: boolean;
  gates: Array<{ name: string; passed: boolean }>;
}> {
  const gates = await getTokenGates(env, communityId);
  if (gates.length === 0) return { passed: true, gates: [] };

  const member = (await getAllCommunityMembers(env, communityId)).find((m) => m.wallet === wallet);
  const balance = member?.tokenBalance ?? 0;

  const results = gates.map((gate) => ({
    name: gate.name,
    passed: balance >= gate.minBalance,
  }));

  return {
    passed: results.every((r) => r.passed),
    gates: results,
  };
}

// ─── Mod Log ───────────────────────────────────────────────────────────

export async function createWebhook(env: Env, hook: WebhookConfig): Promise<void> {
  const store = getStore(env);
  const key = k('feddy', 'webhooks', hook.communityId, hook.id);
  const indexKey = k('feddy', 'webhooks-index', hook.communityId);

  await Promise.all([
    store.put(key, JSON.stringify(hook)),
    (async () => {
      const raw = await store.get(indexKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.push(hook.id);
      await store.put(indexKey, JSON.stringify(ids));
    })(),
  ]);
}

export async function getWebhooks(env: Env, communityId: string): Promise<WebhookConfig[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'webhooks-index', communityId);
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);

    const hooks: WebhookConfig[] = [];
    for (const id of ids) {
      const hookRaw = await store.get(k('feddy', 'webhooks', communityId, id));
      if (hookRaw) hooks.push(JSON.parse(hookRaw) as WebhookConfig);
    }
    return hooks;
  } catch {
    return [];
  }
}

export async function deleteWebhook(
  env: Env,
  communityId: string,
  webhookId: string,
): Promise<boolean> {
  try {
    const store = getStore(env);
    await store.delete(k('feddy', 'webhooks', communityId, webhookId));

    const indexKey = k('feddy', 'webhooks-index', communityId);
    const raw = await store.get(indexKey);
    if (raw) {
      const ids: string[] = JSON.parse(raw).filter((id: string) => id !== webhookId);
      await store.put(indexKey, JSON.stringify(ids));
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Bot API Keys ──────────────────────────────────────────────────────

export async function createBotKey(env: Env, key: BotApiKey): Promise<void> {
  const store = getStore(env);
  const keyId = k('feddy', 'bot-keys', key.communityId, key.id);
  const indexKey = k('feddy', 'bot-keys-index', key.communityId);

  await Promise.all([
    store.put(keyId, JSON.stringify(key)),
    (async () => {
      const raw = await store.get(indexKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.push(key.id);
      await store.put(indexKey, JSON.stringify(ids));
    })(),
  ]);
}

export async function getBotKeys(env: Env, communityId: string): Promise<BotApiKey[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'bot-keys-index', communityId);
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);

    const keys: BotApiKey[] = [];
    for (const id of ids) {
      const keyRaw = await store.get(k('feddy', 'bot-keys', communityId, id));
      if (keyRaw) {
        const botKey = JSON.parse(keyRaw) as BotApiKey;
        // Don't expose key hash in listings
        keys.push(botKey);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

export async function deleteBotKey(env: Env, communityId: string, keyId: string): Promise<boolean> {
  try {
    const store = getStore(env);
    await store.delete(k('feddy', 'bot-keys', communityId, keyId));

    const indexKey = k('feddy', 'bot-keys-index', communityId);
    const raw = await store.get(indexKey);
    if (raw) {
      const ids: string[] = JSON.parse(raw).filter((id: string) => id !== keyId);
      await store.put(indexKey, JSON.stringify(ids));
    }
    return true;
  } catch {
    return false;
  }
}

export async function verifyBotKey(
  env: Env,
  communityId: string,
  keyHash: string,
): Promise<BotApiKey | null> {
  const keys = await getBotKeys(env, communityId);
  return keys.find((k) => k.keyHash === keyHash && k.isActive) ?? null;
}

// ─── Federation Health ─────────────────────────────────────────────────

export async function setFederationHealth(env: Env, health: FederationHealth): Promise<void> {
  await getStore(env).put(
    k('feddy', 'federation-health', health.communityId),
    JSON.stringify(health),
    {
      expirationTtl: 3600,
    },
  );
}

export async function getFederationHealth(
  env: Env,
  communityId: string,
): Promise<FederationHealth | null> {
  try {
    const raw = await getStore(env).get(k('feddy', 'federation-health', communityId));
    return raw ? (JSON.parse(raw) as FederationHealth) : null;
  } catch {
    return null;
  }
}

// ─── Remote Community Discovery ────────────────────────────────────────

export async function addDiscoveredRemoteCommunity(
  env: Env,
  community: RemoteCommunity,
): Promise<void> {
  const store = getStore(env);
  const key = k('feddy', 'discovered-remote', community.instanceUrl, community.id);
  const indexKey = k('feddy', 'discovered-remote-index');

  await Promise.all([
    store.put(key, JSON.stringify(community)),
    (async () => {
      const raw = await store.get(indexKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(community.id)) {
        ids.push(community.id);
        await store.put(indexKey, JSON.stringify(ids));
      }
    })(),
  ]);
}

export async function getDiscoveredRemoteCommunities(
  env: Env,
  limit = 20,
): Promise<RemoteCommunity[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'discovered-remote-index');
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw).slice(0, limit);

    const communities: RemoteCommunity[] = [];
    // Scan by prefix — for production use a proper index
    const _prefix = 'feddy:discovered-remote:';
    // KV list isn't universally available; iterate from known index
    for (const id of ids) {
      // Find by scanning instances — simplified for now
      const instanceIndexKey = k('feddy', 'discovered-remote-instances');
      const instancesRaw = await store.get(instanceIndexKey);
      if (instancesRaw) {
        const instances: string[] = JSON.parse(instancesRaw);
        for (const instance of instances) {
          const cRaw = await store.get(k('feddy', 'discovered-remote', instance, id));
          if (cRaw) {
            communities.push(JSON.parse(cRaw) as RemoteCommunity);
            break;
          }
        }
      }
    }
    return communities;
  } catch {
    return [];
  }
}

// ─── Follower Communities (who follows which communities) ──────────────

export async function trackFollowerCommunity(
  env: Env,
  wallet: string,
  communityId: string,
): Promise<void> {
  const store = getStore(env);
  const key = k('feddy', 'follower-comms', wallet);
  const raw = await store.get(key);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(communityId)) {
    ids.push(communityId);
    await store.put(key, JSON.stringify(ids));
  }
}
