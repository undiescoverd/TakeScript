/**
 * AES-256-GCM encryption helpers for BYOK API keys.
 *
 * Pure module (no Convex function exports). Import only from actions —
 * mutations and queries must never see plaintext keys.
 *
 * Key material comes from the BYOK_ENCRYPTION_SECRET deployment env var
 * (base64-encoded 32 bytes, e.g. `openssl rand -base64 32`). Rotating it
 * invalidates every stored customer key.
 *
 * Stored format: "v1:<b64 iv>:<b64 ciphertext>"
 */

const VERSION = "v1";

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.BYOK_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "BYOK_ENCRYPTION_SECRET is not configured. Set it with: npx convex env set BYOK_ENCRYPTION_SECRET \"$(openssl rand -base64 32)\""
    );
  }

  const keyBytes = base64Decode(secret.trim());
  if (keyBytes.length !== 32) {
    throw new Error(
      "BYOK_ENCRYPTION_SECRET must be base64-encoded 32 bytes (openssl rand -base64 32)"
    );
  }

  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${VERSION}:${base64Encode(iv)}:${base64Encode(new Uint8Array(ciphertext))}`;
}

export async function decryptApiKey(stored: string): Promise<string> {
  const [version, ivB64, ctB64] = stored.split(":");
  if (version !== VERSION || !ivB64 || !ctB64) {
    throw new Error("Unrecognized encrypted key format");
  }

  const key = await getEncryptionKey();
  const iv = base64Decode(ivB64);
  const ciphertext = base64Decode(ctB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export function maskKey(key: string): string {
  return key.slice(-4);
}
