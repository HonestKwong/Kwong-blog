import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "kwong_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(payload: {
  userId: string;
}): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
