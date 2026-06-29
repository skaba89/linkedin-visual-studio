/**
 * HERMÈS — R-004 — Migration script: encrypt existing LinkedIn tokens at rest
 *
 * One-shot script: scans the LinkedInAuth table for rows whose `accessToken`
 * is not yet encrypted (i.e., doesn't start with "v1:") and rewrites them
 * with AES-256-GCM encryption.
 *
 * Usage:
 *   ENCRYPTION_KEY=$(openssl rand -hex 32) \
 *   DATABASE_URL=postgresql://... \
 *   npx tsx scripts/migrate-encrypt-linkedin-tokens.ts
 *
 * Safety:
 *  - Idempotent: rows already encrypted (v1: prefix) are skipped.
 *  - Dry-run mode: `DRY_RUN=1` lists what would be changed without writing.
 *  - Logs every row processed (id, userId, status).
 *
 * After running this script, the `accessToken` column will contain only
 * `v1:...` ciphertexts. Any code that previously read plaintext must be
 * updated to call `decrypt()` (see src/lib/crypto.ts).
 */

import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../src/lib/crypto";

const db = new PrismaClient();

type Row = {
  id: string;
  userId: string;
  accessToken: string;
};

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1";
  console.log(`[migrate-encrypt] starting (dryRun=${dryRun})`);

  if (!process.env.ENCRYPTION_KEY) {
    console.error("[migrate-encrypt] FATAL: ENCRYPTION_KEY env var is not set");
    process.exit(1);
  }
  // Sanity: trigger resolveKey() early to fail fast on bad key format
  try {
    encrypt("test");
  } catch (err) {
    console.error(
      "[migrate-encrypt] FATAL: ENCRYPTION_KEY is invalid:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  const rows: Row[] = await db.linkedInAuth.findMany({
    select: { id: true, userId: true, accessToken: true },
  });

  console.log(`[migrate-encrypt] found ${rows.length} LinkedInAuth row(s)`);

  let encrypted = 0;
  let skipped = 0;
  let empty = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row.accessToken || row.accessToken === "") {
      console.log(
        `[migrate-encrypt] row ${row.id} (user=${row.userId}): empty token — skipping`,
      );
      empty++;
      continue;
    }

    if (isEncrypted(row.accessToken)) {
      console.log(
        `[migrate-encrypt] row ${row.id} (user=${row.userId}): already encrypted — skipping`,
      );
      skipped++;
      continue;
    }

    if (dryRun) {
      const plaintext = row.accessToken as string;
      console.log(
        `[migrate-encrypt] row ${row.id} (user=${row.userId}): would encrypt (plaintext length=${plaintext.length})`,
      );
      encrypted++;
      continue;
    }

    try {
      const ciphertext = encrypt(row.accessToken);
      await db.linkedInAuth.update({
        where: { id: row.id },
        data: { accessToken: ciphertext },
      });
      console.log(
        `[migrate-encrypt] row ${row.id} (user=${row.userId}): encrypted OK`,
      );
      encrypted++;
    } catch (err) {
      console.error(
        `[migrate-encrypt] row ${row.id} (user=${row.userId}): FAILED —`,
        err instanceof Error ? err.message : String(err),
      );
      errors++;
    }
  }

  console.log(`
[migrate-encrypt] done.
  - encrypted: ${encrypted}
  - skipped (already encrypted): ${skipped}
  - empty: ${empty}
  - errors: ${errors}
  - total: ${rows.length}
`);

  if (errors > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("[migrate-encrypt] uncaught error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
