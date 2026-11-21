import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type PublicAgendaAction = "catalog" | "slots" | "book";

// IPv6 privacy addresses share a /64 budget. Canonicalize mapped IPv4 first.
export function normalizeAgendaOrigin(value: string) {
  const input = value.trim();
  if (isIP(input) === 4) return input;
  if (isIP(input) !== 6 || input.includes("%")) return null;
  const host = new URL(`http://[${input}]`).hostname.slice(1, -1);
  const [left, right] = host.split("::");
  const before = left ? left.split(":") : [];
  const after = right ? right.split(":") : [];
  const groups = right === undefined ? before : [...before, ...Array<string>(8 - before.length - after.length).fill("0"), ...after];
  const words = groups.map((group) => parseInt(group, 16));
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 65535) {
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(".");
  }
  return words.slice(0, 4).map((word) => word.toString(16)).join(":") + "::/64";
}

export function signAgendaOrigin(secret: string, origin: string, action: PublicAgendaAction, slug: string, now = Date.now()) {
  if (!/^[0-9a-f]{64}$/.test(secret)) return null;
  const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const origin_key = hmac("origin|" + origin);
  const issued_at = Math.floor(now / 1000);
  const proof = hmac(`agenda-v1|${action}|${slug}|${origin_key}|${issued_at}`);
  return { origin_key, issued_at, proof };
}
