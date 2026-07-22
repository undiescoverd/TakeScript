/**
 * The distinction these tests protect: an unreadable *key* is a user problem
 * with a user fix ("re-enter it"), while a missing or malformed *deployment
 * secret* is an operator problem that re-entering cannot fix. Collapsing the
 * two sends users to re-type a key forever against a broken deployment.
 *
 * Regression origin: rotating BYOK_ENCRYPTION_SECRET left every previously
 * saved key undecryptable, and the raw WebCrypto failure ("OperationError:
 * Decryption failed") escaped to the client and took down all AI features.
 */

import { describe, it, expect, afterEach } from "vitest";
import { encryptApiKey, decryptApiKey, KeyDecryptionError } from "./byokCrypto";

const SECRET_A = "aGVsbG8gd29ybGQgdGhpcyBpcyAzMiBieXRlcyEhISE=";
const SECRET_B = "Z29vZGJ5ZSB3b3JsZCB0aGlzIGlzIDMyIGJ5dGVzISE=";

function setSecret(value: string | undefined) {
  if (value === undefined) delete process.env.BYOK_ENCRYPTION_SECRET;
  else process.env.BYOK_ENCRYPTION_SECRET = value;
}

afterEach(() => setSecret(undefined));

describe("encrypt/decrypt round trip", () => {
  it("returns the original key", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");
    expect(await decryptApiKey(stored)).toBe("sk-or-v1-example");
  });

  it("never stores the plaintext", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");
    expect(stored).not.toContain("sk-or-v1-example");
  });

  it("produces different ciphertext each time (random IV)", async () => {
    setSecret(SECRET_A);
    const a = await encryptApiKey("sk-same-input");
    const b = await encryptApiKey("sk-same-input");
    expect(a).not.toBe(b);
  });
});

describe("KeyDecryptionError — the key is unusable", () => {
  it("is thrown when the secret was rotated after the key was saved", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");

    setSecret(SECRET_B);
    await expect(decryptApiKey(stored)).rejects.toBeInstanceOf(
      KeyDecryptionError
    );
  });

  it("is thrown for a malformed stored value", async () => {
    setSecret(SECRET_A);
    await expect(decryptApiKey("not-a-valid-envelope")).rejects.toBeInstanceOf(
      KeyDecryptionError
    );
  });

  it("does not leak the raw WebCrypto message", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");
    setSecret(SECRET_B);

    await expect(decryptApiKey(stored)).rejects.toThrow(
      /could not be decrypted/i
    );
  });
});

describe("deployment misconfiguration — NOT a KeyDecryptionError", () => {
  it("distinguishes a missing secret, which re-entering a key cannot fix", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");

    setSecret(undefined);
    await expect(decryptApiKey(stored)).rejects.not.toBeInstanceOf(
      KeyDecryptionError
    );
  });

  it("distinguishes a wrong-length secret", async () => {
    setSecret(SECRET_A);
    const stored = await encryptApiKey("sk-or-v1-example");

    setSecret("dG9vLXNob3J0");
    await expect(decryptApiKey(stored)).rejects.not.toBeInstanceOf(
      KeyDecryptionError
    );
  });
});
