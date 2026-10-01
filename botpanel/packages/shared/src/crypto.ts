import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function loadKey(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY muss 32 Byte als Hex (64 Zeichen) sein");
  return key;
}

/** Verschlüsselt einen Text. Format: iv.tag.ciphertext (jeweils base64). */
export function encryptSecret(plain: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, loadKey(hexKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string, hexKey: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("Ungültiges Format des verschlüsselten Werts");
  const decipher = createDecipheriv(ALGO, loadKey(hexKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
