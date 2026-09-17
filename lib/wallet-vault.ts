"use client";

const prefix = "proofly.xrpl.wallet.";

type EncryptedWallet = { address: string; salt: string; iv: string; ciphertext: string };

// WebCrypto's current TypeScript definitions require an ArrayBuffer rather than
// a potentially SharedArrayBuffer-backed typed array.
function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", asArrayBuffer(new TextEncoder().encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: asArrayBuffer(salt), iterations: 210000, hash: { name: "SHA-256" } }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function storeWalletSeed(address: string, seed: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asArrayBuffer(iv) }, key, asArrayBuffer(new TextEncoder().encode(seed)));
  const record: EncryptedWallet = { address, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
  localStorage.setItem(`${prefix}${address}`, JSON.stringify(record));
}

export async function loadWalletSeed(address: string, password: string) {
  const raw = localStorage.getItem(`${prefix}${address}`);
  if (!raw) throw new Error("No encrypted wallet was found in this browser. Restore it using your recovery seed.");
  const record = JSON.parse(raw) as EncryptedWallet;
  const key = await deriveKey(password, fromBase64(record.salt));
  const seed = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asArrayBuffer(fromBase64(record.iv)) }, key, asArrayBuffer(fromBase64(record.ciphertext)));
  return new TextDecoder().decode(seed);
}
