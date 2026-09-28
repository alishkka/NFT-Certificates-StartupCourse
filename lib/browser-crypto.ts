import { Buffer } from "buffer";
import { sha256, sha384 } from "@noble/hashes/sha2.js";

/**
 * The Irys browser uploader currently imports Node's `crypto.randomBytes`.
 * Vite externalizes that module in client bundles, so provide the one API the
 * uploader needs by delegating to the browser's cryptographically-secure RNG.
 */
export function randomBytes(size: number): Buffer {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new RangeError("randomBytes size must be a non-negative integer");
  }

  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

type HashInput = string | ArrayBuffer | ArrayBufferView;
type DigestEncoding = Parameters<Buffer["toString"]>[0];

export function createHash(algorithm: string) {
  const normalized = algorithm.toLowerCase().replace(/-/g, "");
  const hash = normalized === "sha256"
    ? sha256.create()
    : normalized === "sha384"
      ? sha384.create()
      : null;

  if (!hash) {
    throw new Error(`Unsupported browser hash algorithm: ${algorithm}`);
  }

  const api = {
    update(data: HashInput) {
      if (typeof data === "string") {
        hash.update(Buffer.from(data));
      } else if (ArrayBuffer.isView(data)) {
        hash.update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      } else {
        hash.update(new Uint8Array(data));
      }
      return api;
    },
    digest(encoding?: DigestEncoding) {
      const result = Buffer.from(hash.digest());
      return encoding ? result.toString(encoding) : result;
    },
  };

  return api;
}

// Exported only because Irys' browser bundle keeps its unused RSA signer in
// the module graph. Solana certificates use the wallet signer instead.
export const constants = { RSA_PKCS1_PSS_PADDING: 6 } as const;

export function createSign(): never {
  throw new Error("The Node RSA signer is unavailable in the browser");
}

const browserCrypto = { randomBytes, createHash, constants, createSign };

export default browserCrypto;
