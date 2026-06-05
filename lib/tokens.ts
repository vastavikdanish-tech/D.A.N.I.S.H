const TOKEN_EXPIRY_HOURS = 48;

function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-secret";
  return secret;
}

function base64url(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - str.length % 4) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(signature);
}

export async function createPairingToken(userId: string): Promise<string> {
  const secret = getSecret();
  const expiry = Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
  const payload = `${userId}:${expiry}`;
  const signature = await hmacSign(payload, secret);
  const encoded = new TextEncoder().encode(payload);
  return `${base64url(encoded.buffer)}.${signature}`;
}

export async function verifyPairingToken(token: string): Promise<{ userId: string; expiry: number } | null> {
  try {
    const [payloadB64, signatureB64] = token.split(".");
    if (!payloadB64 || !signatureB64) return null;

    const secret = getSecret();
    const payloadBytes = base64urlDecode(payloadB64);
    const payload = new TextDecoder().decode(payloadBytes);
    const [userId, expiryStr] = payload.split(":");
    const expiry = parseInt(expiryStr, 10);

    if (!userId || isNaN(expiry)) return null;

    const expectedSig = await hmacSign(payload, secret);
    if (expectedSig !== signatureB64) return null;

    if (Date.now() > expiry) return null;

    return { userId, expiry };
  } catch {
    return null;
  }
}
