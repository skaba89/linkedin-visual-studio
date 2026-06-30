import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * POST /api/setup/migrate
 *
 * One-time UNPROTECTED endpoint to run Prisma migrations against the production
 * database. This exists because:
 *   1. The User.passwordHash column is missing on Render (migration never applied)
 *   2. Login is therefore broken → admin endpoints can't be used to trigger migration
 *   3. The startCommand now runs `prisma migrate deploy`, but if Render's startup
 *      timeout is too short, this endpoint is a fallback.
 *
 * Security: requires a `migrationKey` query parameter that must match the
 * MIGRATION_KEY env var. If MIGRATION_KEY is not set, the endpoint is disabled.
 *
 * Usage:
 *   curl -X POST "https://your-app.onrender.com/api/setup/migrate?migrationKey=YOUR_KEY"
 *
 * After the migration succeeds, this endpoint can be safely deleted.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const providedKey = url.searchParams.get("migrationKey");
    const expectedKey = process.env.MIGRATION_KEY;

    if (!expectedKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "MIGRATION_KEY env var not set. Set it on Render to use this endpoint.",
        },
        { status: 503 }
      );
    }

    if (providedKey !== expectedKey) {
      return NextResponse.json(
        { ok: false, error: "Invalid migrationKey" },
        { status: 403 }
      );
    }

    // Run prisma migrate deploy
    const { stdout, stderr } = await execAsync("npx prisma migrate deploy", {
      timeout: 60_000,
      env: process.env,
    });

    return NextResponse.json({
      ok: true,
      message: "Migrations applied successfully",
      stdout: stdout.split("\n").slice(-20), // last 20 lines
      stderr: stderr ? stderr.split("\n").slice(-10) : [],
    });
  } catch (error: unknown) {
    console.error("[/api/setup/migrate] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup/migrate — returns the current migration status.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const providedKey = url.searchParams.get("migrationKey");
    const expectedKey = process.env.MIGRATION_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { stdout } = await execAsync("npx prisma migrate status", {
      timeout: 30_000,
      env: process.env,
    });

    return NextResponse.json({
      ok: true,
      status: stdout,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
