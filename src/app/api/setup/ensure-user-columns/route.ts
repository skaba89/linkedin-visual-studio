import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/setup/ensure-user-columns
 *
 * Emergency endpoint to force-add the User.passwordHash, User.passwordSalt,
 * User.role, and User.emailVerified columns to the production database.
 *
 * This endpoint is UNPROTECTED (no auth required) because:
 *   1. The User.passwordHash column is missing → no one can log in
 *   2. Therefore no authenticated endpoint can be used to fix it
 *   3. The SQL is fully idempotent (IF NOT EXISTS) so it's safe to call
 *
 * Once the columns exist, login will work and this endpoint can be deleted.
 *
 * Security: the SQL only adds columns, never reads or modifies data.
 */
export async function GET() {
  const results: Array<{ statement: string; success: boolean; error?: string }> = [];

  const statements = [
    {
      name: "Role enum",
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
          CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
        END IF;
      END $$;`,
    },
    {
      name: "User.passwordHash",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`,
    },
    {
      name: "User.passwordSalt",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;`,
    },
    {
      name: "User.role",
      sql: `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'role'
        ) THEN
          ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
        END IF;
      END $$;`,
    },
    {
      name: "User.emailVerified",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);`,
    },
  ];

  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt.sql);
      results.push({ statement: stmt.name, success: true });
    } catch (err) {
      results.push({
        statement: stmt.name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Verify the columns now exist
  let verification: Array<{ column_name: string; data_type: string }> = [];
  try {
    verification = await db.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'User'
      ORDER BY ordinal_position
    `;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to verify columns after migration",
        results,
        verificationError: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const allSucceeded = results.every((r) => r.success);

  return NextResponse.json(
    {
      ok: allSucceeded,
      message: allSucceeded
        ? "All User columns now exist. Login should work."
        : "Some statements failed — see results array.",
      results,
      userColumns: verification,
    },
    { status: allSucceeded ? 200 : 500 },
  );
}
