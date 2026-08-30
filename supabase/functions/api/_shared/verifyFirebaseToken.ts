// Verifies a Firebase ID token without the Firebase Admin SDK (which isn't
// Deno-compatible). We fetch Google's public signing keys and verify the
// JWT signature + claims ourselves. This is the standard approach for
// verifying Firebase tokens outside of Node/Admin SDK environments.

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiry = 0;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCertsExpiry) return cachedCerts;
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Google signing certs");
  cachedCerts = await res.json();
  // Google rotates these regularly; cache for 1 hour to limit calls.
  cachedCertsExpiry = Date.now() + 60 * 60 * 1000;
  return cachedCerts;
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importCertAsPublicKey(pem: string): Promise<CryptoKey> {
  const certBody = pem
    .replace("-----BEGIN CERTIFICATE-----", "")
    .replace("-----END CERTIFICATE-----", "")
    .replace(/\s/g, "");
  const der = base64UrlDecode(certBody.replace(/-/g, "+").replace(/_/g, "/"));

  // Extract the public key from the X.509 cert by importing it as a cert
  // via the Web Crypto "spki" route isn't directly supported for X.509,
  // so we use the cert bytes with the 'verify' usage through importKey
  // with format 'spki' after stripping the cert wrapper — works because
  // Deno's crypto supports raw X.509 DER for RSASSA-PKCS1-v1_5 here.
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

interface FirebaseClaims {
  sub: string; // Firebase UID
  email?: string;
  name?: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

export async function verifyFirebaseToken(
  idToken: string,
  projectId: string
): Promise<FirebaseClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  const payload: FirebaseClaims = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64))
  );

  // Basic claim checks per Firebase's documented verification rules.
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expired");
  if (payload.iat > now + 60) throw new Error("Token issued in the future");
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token issuer mismatch");
  }
  if (!payload.sub) throw new Error("Token missing subject");

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Unknown signing key");

  const publicKey = await importCertAsPublicKey(cert);
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
  if (!valid) throw new Error("Invalid token signature");

  return payload;
}
