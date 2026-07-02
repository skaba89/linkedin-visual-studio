/**
 * HERMÈS — Compliance guard for LinkedIn actions
 *
 * Wraps every LinkedIn write action (post, comment, like, message, invitation)
 * with two compliance checks:
 *
 *  1. canPerformAction() — block the call if the user has reached their
 *     daily/weekly limit for this action type. Prevents LinkedIn from
 *     flagging the account as automated spam and banning it.
 *  2. recordAction() — increment the per-user usage counter after a
 *     successful action, so the next call can be checked against the limit.
 *
 * Without this guard, the compliance module exists but is never enforced —
 * a user can publish 1000 posts/day and get their LinkedIn account
 * permanently restricted. This is the single highest-risk gap in the
 * product today.
 *
 * Usage in a route:
 *
 *   import { guardLinkedInAction, complianceBlockedResponse } from "@/lib/linkedin/compliance-guard";
 *
 *   const guard = await guardLinkedInAction("post");
 *   if (!guard.allowed) {
 *     if (guard.reason === "AUTH_REQUIRED") {
 *       return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
 *     }
 *     return complianceBlockedResponse(guard.reason ?? "Limite atteinte");
 *   }
 *   // ... perform the LinkedIn API call ...
 *   await guard.record(); // increment counter on success
 */
import { linkedInCompliance } from "@/lib/compliance/linkedin-compliance";
import { requireUser } from "@/lib/session";
import { NextResponse } from "next/server";

export type LinkedInComplianceAction =
  | "post"
  | "comment"
  | "like"
  | "message"
  | "invitation"
  | "profileView";

export interface ComplianceGuard {
  allowed: boolean;
  reason?: string;
  /** Call this AFTER the LinkedIn API call succeeds, to increment the counter. */
  record: () => Promise<void>;
}

/**
 * Pre-flight check for a LinkedIn action. Returns a guard object whose
 * `allowed` flag tells you whether to proceed, and whose `record()` helper
 * increments the per-user usage counter after a successful action.
 */
export async function guardLinkedInAction(
  action: LinkedInComplianceAction,
): Promise<ComplianceGuard> {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch {
    return {
      allowed: false,
      reason: "AUTH_REQUIRED",
      record: async () => {
        /* no-op */
      },
    };
  }

  // Switch the singleton's tenant context to the authenticated user.
  // This is what makes compliance multi-tenant safe — without it, every
  // user's actions would be counted against DEFAULT_USER_ID's quota.
  await linkedInCompliance.initializedForUserId(userId);

  const check = await linkedInCompliance.canPerformAction(action);
  if (!check.allowed) {
    return {
      allowed: false,
      reason: check.reason,
      record: async () => {
        /* no-op — action was blocked */
      },
    };
  }

  return {
    allowed: true,
    record: async () => {
      // Re-establish tenant context in case another request has used the
      // singleton between the pre-flight check and the post-action record.
      await linkedInCompliance.initializedForUserId(userId);
      await linkedInCompliance.recordAction(action);
    },
  };
}

/**
 * Convenience helper: returns a NextResponse for a blocked action.
 * Use when `guard.allowed === false` and `guard.reason !== "AUTH_REQUIRED"`.
 */
export function complianceBlockedResponse(reason: string): NextResponse {
  return NextResponse.json(
    {
      error: "Action bloquée par le garde-fou compliance",
      reason,
      code: "COMPLIANCE_BLOCKED",
    },
    { status: 429 },
  );
}
