import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health
 *
 * Returns service health + DB schema diagnostics.
 *
 * The DB diagnostics are critical for debugging login issues remotely:
 * if User.passwordHash is missing (migration not applied), every login
 * attempt fails with a Prisma error. The health endpoint lets us verify
 * the schema state without SSH access to the Render instance.
 */
export async function GET() {
  const response: {
    status: string;
    timestamp: string;
    service: string;
    env: Record<string, string>;
    db?: {
      connected: boolean;
      error?: string;
      userColumns?: string[];
    };
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "hermes",
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "(not set)",
      // Don't expose secret values, just whether they're set
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "(NOT SET)",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "(NOT SET)",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "(not set)",
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? "set" : "(NOT SET)",
    },
  };

  // Check DB connection + User table schema
  try {
    // Try to query the User table columns directly
    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User'
      ORDER BY ordinal_position
    `;
    response.db = {
      connected: true,
      userColumns: columns.map((c) => c.column_name),
    };
  } catch (err) {
    response.db = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
    response.status = "degraded";
  }

  return NextResponse.json(response);
}
