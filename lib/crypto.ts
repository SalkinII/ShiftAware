// Uses the Web Crypto API (globalThis.crypto.subtle) so this module is
// compatible with Next.js Edge Runtime, Node.js 18+, and browsers.

const encoder = new TextEncoder();

function arrayBufferToHex(buffer: ArrayBuffer | ArrayBufferLike): string {
  return Array.from(new Uint8Array(buffer as ArrayBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function resolveSessionSecretString(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  console.warn(
    "SESSION_SECRET is not set or too short. Auto-generating an ephemeral secret. " +
      "Sessions will not survive server restarts. Set SESSION_SECRET in production.",
  );
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const generated = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  process.env.SESSION_SECRET = generated;
  return generated;
}

let cachedKeyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      const secretStr = resolveSessionSecretString();
      return crypto.subtle.importKey(
        "raw",
        encoder.encode(secretStr),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );
    })();
  }
  return cachedKeyPromise;
}

export async function signValue(payload: string): Promise<string> {
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return `${payload}.${arrayBufferToHex(signature)}`;
}

export async function verifyValue(signed: string): Promise<string | null> {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = signed.substring(0, dotIndex);
  const sigHex = signed.substring(dotIndex + 1);

  if (sigHex.length === 0 || sigHex.length % 2 !== 0) return null;

  const key = await getKey();
  const sigBytes = hexToUint8Array(sigHex);

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(payload),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export function _resetCachedSecret(): void {
  cachedKeyPromise = null;
}
