import { createHmac, randomBytes } from "crypto";

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  console.warn(
    "SESSION_SECRET is not set or too short. Auto-generating an ephemeral secret. " +
      "Sessions will not survive server restarts. Set SESSION_SECRET in production.",
  );
  const generated = randomBytes(32).toString("hex");
  process.env.SESSION_SECRET = generated;
  return generated;
}

let cachedSecret: string | null = null;

function getSecret(): string {
  if (!cachedSecret) {
    cachedSecret = getSessionSecret();
  }
  return cachedSecret;
}

export function signValue(payload: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return `${payload}.${signature}`;
}

export function verifyValue(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = signed.substring(0, dotIndex);
  const signature = signed.substring(dotIndex + 1);

  const hmac = createHmac("sha256", getSecret());
  hmac.update(payload);
  const expected = hmac.digest("hex");

  if (signature.length !== expected.length) return null;

  let match = true;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expected[i]) match = false;
  }

  return match ? payload : null;
}

export function _resetCachedSecret(): void {
  cachedSecret = null;
}
