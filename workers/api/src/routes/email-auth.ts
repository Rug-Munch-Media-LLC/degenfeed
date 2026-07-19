import { type Env, jsonResponse, rateLimit } from "../index";
import { validateBodySize } from "../sanitize";

const EMAIL_PREFIX = "email:";
const PW_RESET_PREFIX = "pwreset:";
const VERIFY_PREFIX = "verify:";
const PW_RESET_TTL = 3600;
const VERIFY_TTL = 86400;

// ─── Password hashing ──────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 600_000,
      hash: "SHA-512",
    },
    key,
    384,
  );
  const saltHex = Array.from(salt, (b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  return `v1:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const saltHex = parts[1]!;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-512" },
    key,
    384,
  );
  const hashHex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === parts[2];
}

// ─── Helpers ───────────────────────────────────────────────────────

async function checkRateLimit(
  request: Request,
  env: Env,
  key: string,
  maxReqs = 5,
  windowMs = 60_000,
): Promise<Response | null> {
  const ip =
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const rl = await rateLimit(env, ip, key, maxReqs, windowMs);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many attempts. Please try again later." }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.ceil(rl.retryAfter / 1000)),
      },
    });
  }
  return null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

// ─── Register ──────────────────────────────────────────────────────

export async function handleEmailRegister(request: Request, env: Env): Promise<Response> {
  const rlResponse = await checkRateLimit(request, env, "email:register");
  if (rlResponse) return rlResponse;

  const bodySizeCheck = validateBodySize(request, 8 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!body.email || !body.password) {
      return jsonResponse({ error: "Email and password are required" }, 400);
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Please enter a valid email address" }, 400);
    }

    if (body.password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters long" }, 400);
    }
    if (body.password.length > 128) {
      return jsonResponse({ error: "Password must be less than 128 characters" }, 400);
    }

    // Check if email already registered
    if (env.CACHE) {
      const existing = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
      if (existing) {
        // Don't reveal whether the email exists, but note: user-facing UX
        // should check with GET /api/auth/email/status first
        return jsonResponse(
          { error: "This email is already registered. Please sign in instead." },
          409,
        );
      }
    }

    const passwordHash = await hashPassword(body.password);
    const userId = crypto.randomUUID();
    const emailToken = crypto.randomUUID();

    const userRecord = JSON.stringify({
      id: userId,
      email,
      displayName: body.displayName || email.split("@")[0] || "user",
      passwordHash,
      emailVerified: false,
      emailToken,
      createdAt: Date.now(),
    });

    if (env.CACHE) {
      await env.CACHE.put(`${EMAIL_PREFIX}${email}`, userRecord);
      await env.CACHE.put(`${VERIFY_PREFIX}${emailToken}`, email, { expirationTtl: VERIFY_TTL });
    }

    // Send verification email if Postmark configured
    if (env.POSTMARK_SERVER_TOKEN && env.CACHE) {
      try {
        const verifyUrl = `https://${new URL(request.url).hostname}/api/auth/email/verify?token=${emailToken}`;
        await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-postmark-server-token": env.POSTMARK_SERVER_TOKEN,
          },
          body: JSON.stringify({
            From: "noreply@degenfeed.xyz",
            To: email,
            Subject: "Verify your DegenFeed account",
            HtmlBody: `<p>Welcome to DegenFeed!</p><p>Click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
            MessageStream: "outbound",
          }),
        });
      } catch {
        /* email delivery failure is non-fatal */
      }
    }

    return jsonResponse({
      success: true,
      message: "Account created. Please check your email to verify your account.",
      requiresVerification: true,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}

// ─── Sign In ───────────────────────────────────────────────────────

export async function handleEmailSignIn(request: Request, env: Env): Promise<Response> {
  const rlResponse = await checkRateLimit(request, env, "email:signin");
  if (rlResponse) return rlResponse;

  const bodySizeCheck = validateBodySize(request, 8 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return jsonResponse({ error: "Email and password are required" }, 400);
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Invalid email or password" }, 401);
    }

    if (!env.CACHE) {
      return jsonResponse({ error: "Email auth not available. Connect a wallet to sign in." }, 501);
    }

    const raw = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
    if (!raw) {
      return jsonResponse({ error: "Invalid email or password" }, 401);
    }

    const userRecord = JSON.parse(raw) as {
      id?: string;
      email?: string;
      displayName?: string;
      passwordHash?: string;
      emailVerified?: boolean;
    };

    if (!userRecord.passwordHash) {
      return jsonResponse({ error: "This account uses a different sign-in method." }, 401);
    }

    const valid = await verifyPassword(body.password, userRecord.passwordHash);
    if (!valid) {
      return jsonResponse({ error: "Invalid email or password" }, 401);
    }

    return jsonResponse({
      success: true,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified ?? false,
      },
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}

// ─── Email Verification ────────────────────────────────────────────

export async function handleEmailVerify(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return jsonResponse({ error: "Missing verification token" }, 400);
  }

  if (!env.CACHE) {
    return jsonResponse({ error: "Email verification not available" }, 501);
  }

  const email = await env.CACHE.get(`${VERIFY_PREFIX}${token}`);
  if (!email) {
    return jsonResponse(
      { error: "Invalid or expired verification token. Please request a new one." },
      400,
    );
  }

  const raw = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
  if (!raw) {
    return jsonResponse({ error: "Account not found" }, 404);
  }

  const userRecord = JSON.parse(raw) as {
    emailVerified?: boolean;
  };

  userRecord.emailVerified = true;
  await env.CACHE.put(`${EMAIL_PREFIX}${email}`, JSON.stringify(userRecord));
  await env.CACHE.delete(`${VERIFY_PREFIX}${token}`);

  return jsonResponse({
    success: true,
    message: "Email verified successfully! You can now sign in.",
  });
}

// ─── Password Reset Request ────────────────────────────────────────

export async function handlePasswordResetRequest(request: Request, env: Env): Promise<Response> {
  const rlResponse = await checkRateLimit(request, env, "email:pw-reset-request", 3, 300_000);
  if (rlResponse) return rlResponse;

  const bodySizeCheck = validateBodySize(request, 4 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as { email?: string };
    if (!body.email) {
      return jsonResponse({ error: "Email is required" }, 400);
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      // Don't reveal if email exists — still return success
      return jsonResponse({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    if (!env.CACHE) {
      return jsonResponse({ error: "Password reset not available" }, 501);
    }

    const raw = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
    if (!raw) {
      // Don't reveal if email exists
      return jsonResponse({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomUUID();
    await env.CACHE.put(`${PW_RESET_PREFIX}${resetToken}`, email, { expirationTtl: PW_RESET_TTL });

    // Send reset email if Postmark configured
    if (env.POSTMARK_SERVER_TOKEN) {
      try {
        const resetUrl = `https://${new URL(request.url).hostname}/auth/reset-password?token=${resetToken}`;
        await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-postmark-server-token": env.POSTMARK_SERVER_TOKEN,
          },
          body: JSON.stringify({
            From: "noreply@degenfeed.xyz",
            To: email,
            Subject: "Reset your DegenFeed password",
            HtmlBody: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
            MessageStream: "outbound",
          }),
        });
      } catch {
        /* non-fatal */
      }
    }

    return jsonResponse({
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}

// ─── Password Reset Confirm ────────────────────────────────────────

export async function handlePasswordResetConfirm(request: Request, env: Env): Promise<Response> {
  const rlResponse = await checkRateLimit(request, env, "email:pw-reset-confirm", 3, 60_000);
  if (rlResponse) return rlResponse;

  const bodySizeCheck = validateBodySize(request, 8 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as { token?: string; password?: string };

    if (!body.token || !body.password) {
      return jsonResponse({ error: "Token and new password are required" }, 400);
    }

    if (body.password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters long" }, 400);
    }

    if (!env.CACHE) {
      return jsonResponse({ error: "Password reset not available" }, 501);
    }

    const email = await env.CACHE.get(`${PW_RESET_PREFIX}${body.token}`);
    if (!email) {
      return jsonResponse(
        { error: "Invalid or expired reset token. Please request a new one." },
        400,
      );
    }

    const raw = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
    if (!raw) {
      return jsonResponse({ error: "Account not found" }, 404);
    }

    const userRecord = JSON.parse(raw) as { passwordHash?: string };
    userRecord.passwordHash = await hashPassword(body.password);
    await env.CACHE.put(`${EMAIL_PREFIX}${email}`, JSON.stringify(userRecord));
    await env.CACHE.delete(`${PW_RESET_PREFIX}${body.token}`);

    return jsonResponse({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password.",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}

// ─── Email Status Check ────────────────────────────────────────────

export async function handleEmailStatus(request: Request, env: Env): Promise<Response> {
  const rlResponse = await checkRateLimit(request, env, "email:status", 3, 60_000);
  if (rlResponse) return rlResponse;

  const url = new URL(request.url);
  const emailParam = url.searchParams.get("email");
  if (!emailParam) {
    return jsonResponse({ error: "Email is required" }, 400);
  }

  const email = normalizeEmail(emailParam);
  if (!isValidEmail(email)) {
    return jsonResponse({ hasAccount: false, isVerified: false });
  }

  if (!env.CACHE) {
    return jsonResponse({ hasAccount: false, isVerified: false });
  }

  const raw = await env.CACHE.get(`${EMAIL_PREFIX}${email}`);
  if (!raw) {
    return jsonResponse({ hasAccount: false, isVerified: false });
  }

  const userRecord = JSON.parse(raw) as { emailVerified?: boolean };
  return jsonResponse({
    hasAccount: true,
    isVerified: userRecord.emailVerified ?? false,
  });
}
