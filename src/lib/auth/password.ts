import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** bcrypt silently truncates beyond 72 bytes — reject instead of truncating. */
export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("too_short");
  if (Buffer.byteLength(password, "utf8") > 72) issues.push("too_long");
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) issues.push("weak");
  return issues;
}

/** Opaque token hash used for sessions and one-time links (SHA-256, constant cost). */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}
