// S4 — run DB work as the Supabase `authenticated` role so Row-Level Security
// actually applies. The app's Prisma connection uses the `postgres` role, which
// has BYPASSRLS; without this wrapper, RLS policies never fire for app writes.
//
// Inside one transaction we:
//   1) SET LOCAL ROLE authenticated   → drop BYPASSRLS for the rest of the tx
//   2) set request.jwt.claims.sub     → makes auth.uid() resolve to this user
// Both are SET LOCAL (transaction-scoped), which is the only safe way under the
// PgBouncer transaction-mode pooler (the whole tx is pinned to one connection).
//
// Use for the IDOR-sensitive content surface (/api/state). Server-only admin
// reads/writes that legitimately span users (invite resolution, membership
// management in /api/share) keep using the privileged `prisma` directly.
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export function withUser<T>(
  uid: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts?: { timeout?: number; maxWait?: number }
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    // set_config(name, value, is_local=true) == SET LOCAL, and is parameterised
    // ($1) so the uid can't break out of the string (injection-safe).
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify(
      { sub: uid }
    )}, true)`;
    return fn(tx);
  }, opts);
}
