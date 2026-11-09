async function getKey() {
  const raw = process.env["SMTP_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Encryption key not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (buf) => Buffer.from(buf).toString("base64");
async function encryptSecret(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), new TextEncoder().encode(plain));
  return `${b64(iv)}:${b64(ct)}`;
}
async function decryptSecret(enc) {
  const [ivB = "", ctB = ""] = enc.split(":");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(Buffer.from(ivB, "base64")) },
    await getKey(),
    new Uint8Array(Buffer.from(ctB, "base64"))
  );
  return new TextDecoder().decode(pt);
}
export {
  decryptSecret,
  encryptSecret
};
