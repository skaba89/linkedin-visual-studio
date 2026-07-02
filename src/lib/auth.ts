import { getServerSession as _getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * Server-side helper to retrieve the current NextAuth session.
 *
 * Usage in API routes / server components:
 *   import { getServerSession } from "@/lib/auth";
 *   const session = await getServerSession();
 *   if (!session) return unauthorized();
 */
export function getServerSession() {
  return _getServerSession(authOptions);
}
