import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthenticatedSession = {
  sub: string;
  email: string;
  role: "admin" | "user";
  exp: number;
};

function sessionSecret(): string | null {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return process.env.NODE_ENV === "development"
    ? "courtly-development-session-secret"
    : null;
}

export function createSessionToken(
  user: Pick<AuthenticatedSession, "sub" | "email" | "role">,
): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET belum dikonfigurasi.");

  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | null): AuthenticatedSession | null {
  const secret = sessionSecret();
  if (!token || !secret) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AuthenticatedSession>;
    if (
      typeof session.sub !== "string" ||
      typeof session.email !== "string" ||
      (session.role !== "admin" && session.role !== "user") ||
      typeof session.exp !== "number" ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session as AuthenticatedSession;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): AuthenticatedSession | null {
  const cookie = request.headers.get("cookie");
  const token = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("courtly_session="))
    ?.slice("courtly_session=".length);
  return verifySessionToken(token ? decodeURIComponent(token) : null);
}

export function isAdminAuthorized(request: Request): boolean {
  return getSessionFromRequest(request)?.role === "admin";
}
