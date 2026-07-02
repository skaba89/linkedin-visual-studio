/**
 * HERMÈS — Phase 3.9 — /api/setup/ensure-engagement-tables
 *
 * Emergency endpoint to force-create the 4 engagement tables and the
 * UserSettings engagement columns, in case the runtime migration in
 * instrumentation-node.ts didn't run (e.g., the deployment is in a
 * weird state, or the migration silently failed).
 *
 * This endpoint is UNPROTECTED (no auth required) because:
 *   1. The engagement tables may be missing → /api/data/reactors etc. all 500
 *   2. We can't require auth to debug a 500 that affects authenticated users
 *   3. The SQL is fully idempotent (CREATE TABLE IF NOT EXISTS,
 *      ALTER TABLE ADD COLUMN IF NOT EXISTS, DO $$ IF NOT EXISTS ...)
 *
 * Call this once after deploying if you see 500s on the engagement endpoints:
 *
 *   curl https://linkedin-visual-studio.onrender.com/api/setup/ensure-engagement-tables
 *
 * Security: the SQL only creates schema, never reads or modifies user data.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUserColumns } from "@/lib/runtime-migration";

export async function GET() {
  const results: Array<{ step: string; success: boolean; error?: string }> = [];

  // Step 1: Run the full runtime migration (which includes engagement tables)
  // Pass force=true so it re-runs even if already attempted at boot (where it
  // may have silently failed).
  try {
    await ensureUserColumns(true);
    results.push({ step: "runtime-migration (ensureUserColumns)", success: true });
  } catch (err) {
    results.push({
      step: "runtime-migration (ensureUserColumns)",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 2: Verify the engagement tables exist
  let tableCheck: Array<{ table_name: string }> = [];
  try {
    tableCheck = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('LinkedInReactor', 'TrendingTopic', 'ProfileVisitor', 'ExpertComment', 'UsageQuota', 'Integration', 'Workspace', 'WorkspaceMember', 'WorkspaceInvitation')
      ORDER BY table_name
    `;
    results.push({
      step: "verify-tables-exist",
      success: true,
    });
  } catch (err) {
    results.push({
      step: "verify-tables-exist",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 3: Verify the UserSettings engagement columns exist
  let columnCheck: Array<{ column_name: string }> = [];
  try {
    columnCheck = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'UserSettings'
        AND column_name IN (
          'engagementAutoReply',
          'engagementMaxDailyComments',
          'engagementTone',
          'engagementMinHoursBetween',
          'plan',
          'stripeCustomerId',
          'currentWorkspaceId'
        )
      ORDER BY column_name
    `;
    results.push({
      step: "verify-usersettings-columns",
      success: true,
    });
  } catch (err) {
    results.push({
      step: "verify-usersettings-columns",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const expectedTables = [
    "LinkedInReactor",
    "TrendingTopic",
    "ProfileVisitor",
    "ExpertComment",
    "UsageQuota",
    "Integration",
    "Workspace",
    "WorkspaceMember",
    "WorkspaceInvitation",
  ];
  const foundTables = tableCheck.map((r) => r.table_name);
  const missingTables = expectedTables.filter((t) => !foundTables.includes(t));

  const expectedColumns = [
    "engagementAutoReply",
    "engagementMaxDailyComments",
    "engagementTone",
    "engagementMinHoursBetween",
    "plan",
    "stripeCustomerId",
    "currentWorkspaceId",
  ];
  const foundColumns = columnCheck.map((r) => r.column_name);
  const missingColumns = expectedColumns.filter((c) => !foundColumns.includes(c));

  const allOk = missingTables.length === 0 && missingColumns.length === 0;

  return NextResponse.json(
    {
      ok: allOk,
      message: allOk
        ? "All engagement tables and UserSettings columns exist. The /api/data/reactors, /api/data/profile-visitors, /api/data/trending, /api/data/engagement-settings endpoints should now work."
        : "Some tables or columns are still missing. See missingTables / missingColumns.",
      results,
      tables: {
        expected: expectedTables,
        found: foundTables,
        missing: missingTables,
      },
      userSettingsColumns: {
        expected: expectedColumns,
        found: foundColumns,
        missing: missingColumns,
      },
    },
    { status: allOk ? 200 : 500 },
  );
}
