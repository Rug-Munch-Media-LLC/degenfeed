export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * DegenFeed — Unified Auth Callback Handler
 *
 * Route: /auth/callback
 * Handles OAuth2 redirects from all supported providers.
 * Exchanges the authorization code for a token via the worker API,
 * then stores the result client-side for AuthProvider to process.
 */

interface AuthCallbackProps {
  searchParams: Promise<{
    code?: string;
    error?: string;
    state?: string;
    provider?: string;
  }>;
}

/** Map provider path to its API callback endpoint */
const PROVIDER_CONFIG: Record<string, { name: string; endpoint: string; icon: string }> = {
  gotosocial: {
    name: 'GoToSocial',
    endpoint: '/api/auth/gotosocial/callback',
    icon: '🐘',
  },
  google: {
    name: 'Google',
    endpoint: '/api/auth/google/callback',
    icon: 'G',
  },
  github: {
    name: 'GitHub',
    endpoint: '/api/auth/github/callback',
    icon: '🐙',
  },
  discord: {
    name: 'Discord',
    endpoint: '/api/auth/discord/callback',
    icon: '🎮',
  },
  twitter: {
    name: 'Twitter / X',
    endpoint: '/api/auth/twitter/callback',
    icon: '𝕏',
  },
  telegram: {
    name: 'Telegram',
    endpoint: '/api/auth/telegram/callback',
    icon: '✈',
  },
  threads: {
    name: 'Threads',
    endpoint: '/api/auth/threads/callback',
    icon: '🧵',
  },
  warpcast: {
    name: 'Warpcast',
    endpoint: '/api/auth/warpcast/callback',
    icon: '◈',
  },
  reddit: {
    name: 'Reddit',
    endpoint: '/api/auth/reddit/callback',
    icon: '🔴',
  },
};

interface CallbackResult {
  accessToken?: string;
  profile?: {
    id?: string;
    username?: string;
    displayName?: string;
    avatar?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function exchangeCode(
  code: string,
  state: string | null,
  endpoint: string,
  apiBase: string,
): Promise<{ ok: boolean; data?: CallbackResult; error?: string }> {
  try {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });

    if (res.ok) {
      const data = (await res.json()) as CallbackResult;
      if (data.accessToken || data.success) {
        return { ok: true, data };
      }
      return { ok: false, error: 'No access token in response. Please try again.' };
    }

    const err = (await res.json().catch(() => ({ error: `Server returned ${res.status}` }))) as {
      error?: string;
    };
    return {
      ok: false,
      error:
        err.error || `Authentication server returned an error (${res.status}). Please try again.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Cannot reach auth server: ${err.message}`
          : 'Network error. Check your connection and try again.',
    };
  }
}

export default async function AuthCallbackPage({ searchParams }: AuthCallbackProps) {
  const params = await searchParams;

  // Determine provider from URL or provider param
  const url = new URL(
    typeof window !== 'undefined' ? window.location.href : 'https://degenfeed.xyz',
  );
  const pathParts = url.pathname.split('/');
  const providerFromPath = pathParts[pathParts.length - 1] || params.provider || 'gotosocial';
  const provider = PROVIDER_CONFIG[providerFromPath] ?? PROVIDER_CONFIG['gotosocial']!;

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  // == Error from OAuth provider ==
  if (params.error) {
    return (
      <ErrorView
        provider={provider}
        message={`${provider.name} declined authorization: ${params.error}`}
      />
    );
  }

  // == No code ==
  if (!params.code) {
    return (
      <ErrorView
        provider={provider}
        message="No authorization code received. This usually means the login was cancelled or the callback URL was opened directly."
      />
    );
  }

  // == Exchange code for token ==
  const result = await exchangeCode(params.code, params.state ?? null, provider.endpoint, apiBase);

  // == Success ==
  if (result.ok && result.data) {
    const pending = JSON.stringify({
      protocol: providerFromPath,
      ...result.data,
      linkedAt: Date.now(),
    });

    return (
      <html lang="en">
        <body>
          <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 text-6xl">{provider.icon}</div>
            <h1 className="mb-2 text-2xl font-bold text-white">Connected to {provider.name}!</h1>
            <p className="mb-8 text-zinc-400">Setting up your profile...</p>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-full animate-pulse rounded-full bg-green-500" />
            </div>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `try {
                localStorage.setItem('degenfeed_pending_identity', ${JSON.stringify(pending).replace(/</g, '\\u003c')});
                localStorage.setItem('degenfeed_auth_updated', Date.now().toString());
                localStorage.setItem('degenfeed_oauth_provider', ${JSON.stringify(providerFromPath)});
              } catch(e) { console.error('Token storage failed', e); }
              window.location.href = '/home';`,
            }}
          />
        </body>
      </html>
    );
  }

  // == Exchange failed ==
  return (
    <ErrorView provider={provider} message={result.error ?? 'Failed to complete authentication.'} />
  );
}

function ErrorView({
  provider,
  message,
}: {
  provider: (typeof PROVIDER_CONFIG)[string];
  message: string;
}) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <div className="mb-6 text-6xl">{provider.icon}</div>
          <h1 className="mb-2 text-xl font-bold text-red-400">Sign-in Failed</h1>
          <p className="mb-1 text-sm text-zinc-300">{provider.name}</p>
          <p className="mb-8 max-w-sm text-sm text-zinc-400">{message}</p>
          <a
            href="/home"
            className="inline-block rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to DegenFeed
          </a>
        </div>
      </body>
    </html>
  );
}
