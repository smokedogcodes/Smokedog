import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function hashAdminPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return `${s}:${hash}`;
}

export function verifyAdminPassword(
  password: string,
  stored: string
): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(password, salt, 64);
    const prev = Buffer.from(hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

/** Plain password compare when ADMIN_PASSWORD is set (dev / bootstrap). */
export function verifyAdminCredentials(
  user: string,
  password: string
): boolean {
  const g = globalThis as unknown as {
    __SMOKEDOG_ADMIN__?: {
      user?: string;
      password?: string;
      passwordHash?: string;
      sessionSecret?: string;
    };
  };
  const expectedUser =
    g.__SMOKEDOG_ADMIN__?.user || process.env.ADMIN_USER || "";
  const passwordHash =
    g.__SMOKEDOG_ADMIN__?.passwordHash || process.env.ADMIN_PASSWORD_HASH || "";
  const plainPassword =
    g.__SMOKEDOG_ADMIN__?.password || process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || user !== expectedUser) return false;
  if (passwordHash) return verifyAdminPassword(password, passwordHash);
  if (plainPassword) {
    const a = Buffer.from(password);
    const b = Buffer.from(plainPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  return false;
}

export function createAdminSessionToken(): string {
  const g = globalThis as unknown as {
    __SMOKEDOG_ADMIN__?: { sessionSecret?: string; password?: string };
  };
  const secret =
    g.__SMOKEDOG_ADMIN__?.sessionSecret ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    g.__SMOKEDOG_ADMIN__?.password ||
    "dev";
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${exp}.${randomBytes(16).toString("hex")}`;
  const sig = scryptSync(payload, secret, 32).toString("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const g = globalThis as unknown as {
    __SMOKEDOG_ADMIN__?: { sessionSecret?: string; password?: string };
  };
  const secret =
    g.__SMOKEDOG_ADMIN__?.sessionSecret ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    g.__SMOKEDOG_ADMIN__?.password ||
    "dev";
  const payload = `${expStr}.${nonce}`;
  try {
    const expected = scryptSync(payload, secret, 32);
    const got = Buffer.from(sig!, "hex");
    if (expected.length !== got.length) return false;
    return timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}
