export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * DegenFeed — Auth Callback Handler
 *
 * Route: /auth/callback
 * Handles OAuth2 redirects from GotoSocial (social.degenfeed.xyz).
 * Exchanges the authorization code for an access token via the worker API.
 */

interface AuthCallbackProps {
  searchParams: Promise<{ code?: string; error?: string; state?: string }>;
}

interface CallbackProfile {
  id?: string;
  username?: string;
  acct?: string;
  displayName?: string;
  avatar?: string;
}

interface CallbackData {
  accessToken?: string;
  profile?: CallbackProfile;
}

export default async function AuthCallbackPage({ searchParams }: AuthCallbackProps) {
  const params = await searchParams;

  if (params.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mb-6 text-5xl text-red-400">!</div>
        <h1 className="mb-4 text-2xl font-bold text-red-400">Authorization Failed</h1>
        <p className="mb-8 text-gray-400">{params.error}</p>
        <a href="/home" className="btn-primary inline-block">
          Back to DegenFeed
        </a>
      </div>
    );
  }

  if (!params.code) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mb-6 text-5xl text-gray-500">?</div>
        <h1 className="mb-4 text-2xl font-bold text-white">No Authorization Code</h1>
        <p className="mb-8 text-gray-400">
          No authorization code was received. Please try signing in again.
        </p>
        <a href="/home" className="btn-primary inline-block">
          Back to DegenFeed
        </a>
      </div>
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  let exchangeOk = false;
  let exchangeError = '';
  let tokenData: CallbackData = {};

  try {
    const res = await fetch(`${apiBase}/api/auth/gotosocial/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: params.code, state: params.state }),
    });

    if (res.ok) {
      const data = (await res.json()) as CallbackData;
      if (data.accessToken) {
        exchangeOk = true;
        tokenData = data;
      } else {
        exchangeError = 'No access token in response';
      }
    } else {
      const err = (await res.json()) as { error?: string };
      exchangeError = err.error ?? 'Token exchange failed';
    }
  } catch (err) {
    exchangeError = err instanceof Error ? err.message : 'Network error';
  }

  if (exchangeOk) {
    const pending = JSON.stringify({
      protocol: 'mastodon',
      accessToken: tokenData.accessToken,
      profile: tokenData.profile,
    });

    return (
      <html lang="en">
        <body>
          <div className="mx-auto max-w-md px-4 py-20 text-center">
            <div className="mb-6 text-5xl text-degen-400">✓</div>
            <h1 className="mb-4 text-2xl font-bold text-white">Signed in!</h1>
            <p className="mb-8 text-gray-400">Redirecting to your feed...</p>
          </div>
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated JSON stringified token stored client-side
            dangerouslySetInnerHTML={{
              __html: `try { localStorage.setItem('degenfeed_pending_identity', ${JSON.stringify(
                pending,
              )}); localStorage.setItem('degenfeed_auth_updated', Date.now().toString()); } catch(e) { console.error('Token storage failed', e); } window.location.href = '/home';`,
            }}
          />
        </body>
      </html>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mb-6 text-5xl text-red-400">!</div>
      <h1 className="mb-4 text-2xl font-bold text-red-400">Exchange Failed</h1>
      <p className="mb-2 text-gray-400">{exchangeError}</p>
      <p className="mb-8 text-sm text-gray-600">Code: {params.code.slice(0, 30)}...</p>
      <a href="/home" className="btn-primary inline-block">
        Back to DegenFeed
      </a>
    </div>
  );
}
