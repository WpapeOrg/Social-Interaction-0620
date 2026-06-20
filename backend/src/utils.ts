import crypto from "crypto";

export function codeToOpenId(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex").slice(0, 32);
}

export function normalizeBearerToken(raw = ""): string | null {
  if (!raw) return null;
  return raw.replace(/^Bearer\s+/i, "").trim() || null;
}
