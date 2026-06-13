import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

/**
 * GET /api/auth/session
 * Returns the current NextAuth session as JSON.
 */
export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, ...session });
}
