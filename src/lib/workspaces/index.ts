/**
 * HERMÈS — Phase 4.4 — Workspaces & team access
 *
 * Helpers for team workspace management:
 *   - createWorkspace(userId, name): creates a workspace + adds owner as admin
 *   - getAccessibleUserIds(userId): returns user IDs whose data the current
 *     user can see (their own + workspace members' if in team mode)
 *   - getCurrentWorkspace(userId): returns the active workspace or null
 *   - switchWorkspace(userId, workspaceId|null): sets currentWorkspaceId
 *   - inviteMember(workspaceId, email, role, invitedBy): creates an invitation
 *   - acceptInvitation(token, userId): accepts an invitation
 *   - removeMember(workspaceId, userId, removedBy): removes a member
 *   - checkPermission(userId, action): role-based permission check
 *
 * Roles & permissions:
 *   admin:  manage_members, view_billing, edit_settings, full CRUD
 *   member: full CRUD on workspace data
 *   viewer: read-only
 *
 * The owner is always an admin and cannot be removed.
 */

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { getPlan } from "@/lib/billing/plans";
import { createLogger } from "@/lib/logger";
import { randomBytes } from "node:crypto";

const log = createLogger("workspaces");

const INVITATION_EXPIRY_DAYS = 7;

export type WorkspaceRole = "admin" | "member" | "viewer";

export interface WorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: WorkspaceRole; // the current user's role in this workspace
  memberCount: number;
  createdAt: Date;
}

/**
 * Generate a URL-friendly slug from a name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `ws-${Date.now().toString(36)}`;
}

/**
 * Generate a unique slug by appending a short suffix if needed.
 */
async function uniqueSlug(baseName: string): Promise<string> {
  const base = slugify(baseName);
  let slug = base;
  let suffix = 1;
  while (await db.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix++;
    if (suffix > 100) {
      slug = `${base}-${randomBytes(3).toString("hex")}`;
      break;
    }
  }
  return slug;
}

/**
 * Generate a random invitation token (32 hex chars = 128 bits).
 */
function generateToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create a new workspace. The creator becomes the owner (admin role).
 */
export async function createWorkspace(
  userId: string,
  name: string,
): Promise<WorkspaceWithRole> {
  if (!name.trim()) {
    throw new HttpError(400, "Le nom du workspace est requis", "VALIDATION_ERROR");
  }

  // Check the user's plan allows team workspaces
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { plan: true },
  });
  const plan = getPlan(settings.plan);
  if (!plan.quotas.teamWorkspaces) {
    throw new HttpError(
      403,
      `Les workspaces équipe nécessitent le plan Business ou supérieur`,
      "ADMIN_REQUIRED",
      { currentPlan: plan.id, requiredPlan: "business" },
    );
  }

  const slug = await uniqueSlug(name);

  // Create workspace + owner membership in a transaction
  const workspace = await db.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name: name.trim(), slug, ownerId: userId },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: "admin",
      },
    });
    return ws;
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerId: workspace.ownerId,
    role: "admin",
    memberCount: 1,
    createdAt: workspace.createdAt,
  };
}

/**
 * List all workspaces the user is a member of.
 */
export async function listUserWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    ownerId: m.workspace.ownerId,
    role: m.role as WorkspaceRole,
    memberCount: m.workspace._count.members,
    createdAt: m.workspace.createdAt,
  }));
}

/**
 * Get the user's current workspace (or null if in personal mode).
 */
export async function getCurrentWorkspace(userId: string): Promise<WorkspaceWithRole | null> {
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { currentWorkspaceId: true },
  });

  if (!settings.currentWorkspaceId) return null;

  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: settings.currentWorkspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!membership) {
    // User is no longer a member — clear the currentWorkspaceId
    await db.userSettings.update({
      where: { userId },
      data: { currentWorkspaceId: null },
    });
    return null;
  }

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    ownerId: membership.workspace.ownerId,
    role: membership.role as WorkspaceRole,
    memberCount: membership.workspace._count.members,
    createdAt: membership.workspace.createdAt,
  };
}

/**
 * Switch the user's current workspace. Pass null to switch to personal mode.
 */
export async function switchWorkspace(
  userId: string,
  workspaceId: string | null,
): Promise<void> {
  if (workspaceId) {
    // Verify the user is a member
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!membership) {
      throw new HttpError(403, "Vous n'êtes pas membre de ce workspace", "ADMIN_REQUIRED");
    }
  }

  await db.userSettings.upsert({
    where: { userId },
    create: { userId, currentWorkspaceId: workspaceId },
    update: { currentWorkspaceId: workspaceId },
  });

  log.info("User switched workspace", { userId, workspaceId });
}

/**
 * Get the list of user IDs whose data the current user can see.
 * - Personal mode: [userId]
 * - Team mode: [userId, ...memberIds of current workspace]
 */
export async function getAccessibleUserIds(userId: string): Promise<string[]> {
  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) return [userId];

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: { userId: true },
  });

  return [userId, ...members.map((m) => m.userId)];
}

/**
 * Check if a user has a specific permission in their current workspace.
 * In personal mode, the user has all permissions.
 */
export async function checkPermission(
  userId: string,
  action: "manage_members" | "view_billing" | "edit_settings" | "create" | "update" | "delete" | "read",
): Promise<boolean> {
  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) return true; // personal mode = full access

  switch (action) {
    case "manage_members":
    case "view_billing":
    case "edit_settings":
      return workspace.role === "admin";
    case "create":
    case "update":
    case "delete":
      return workspace.role === "admin" || workspace.role === "member";
    case "read":
      return true; // all roles can read
    default:
      return false;
  }
}

/**
 * Invite a user to a workspace by email.
 * Generates a signed token and sends an invitation email (if email is configured).
 */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedBy: string,
): Promise<{ id: string; token: string; expiresAt: Date }> {
  // Verify the inviter is an admin
  const inviterMembership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: invitedBy } },
  });
  if (!inviterMembership || inviterMembership.role !== "admin") {
    throw new HttpError(403, "Seuls les administrateurs peuvent inviter", "ADMIN_REQUIRED");
  }

  // Check if the user is already a member
  const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    const existingMembership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (existingMembership) {
      throw new HttpError(409, "Cet utilisateur est déjà membre", "CONFLICT");
    }
  }

  // Check for existing pending invitation
  const existingInvitation = await db.workspaceInvitation.findFirst({
    where: { workspaceId, email: email.toLowerCase(), status: "pending" },
  });
  if (existingInvitation) {
    throw new HttpError(409, "Une invitation est déjà en attente pour cet email", "CONFLICT");
  }

  // Check the workspace's seat limit (based on owner's plan)
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) throw HttpError.notFound("Workspace");

  const ownerSettings = await db.userSettings.findUnique({
    where: { userId: workspace.ownerId },
    select: { plan: true },
  });
  const plan = getPlan(ownerSettings?.plan ?? "free");
  const memberCount = await db.workspaceMember.count({ where: { workspaceId } });
  // Plus pending invitations
  const pendingCount = await db.workspaceInvitation.count({
    where: { workspaceId, status: "pending" },
  });
  // Business = 3 seats, Enterprise = unlimited
  // (free and pro don't have workspaces enabled, so this should never hit)
  if (plan.id === "business" && memberCount + pendingCount >= 3) {
    throw new HttpError(
      402,
      `Limite de sièges atteinte (plan Business: 3 sièges). Passez au plan Enterprise pour des sièges illimités.`,
      "QUOTA_EXCEEDED",
      { currentPlan: plan.id, currentSeats: memberCount + pendingCount, limit: 3 },
    );
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await db.workspaceInvitation.create({
    data: {
      workspaceId,
      email: email.toLowerCase(),
      role,
      token,
      invitedBy,
      expiresAt,
    },
  });

  log.info("Workspace invitation created", {
    workspaceId,
    email,
    role,
    invitedBy,
    invitationId: invitation.id,
  });

  // TODO: send invitation email if email is configured
  // For now, the UI displays the invite link directly

  return { id: invitation.id, token, expiresAt };
}

/**
 * Accept a workspace invitation.
 * Creates a WorkspaceMember row + clears the invitation.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const invitation = await db.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invitation) {
    throw new HttpError(404, "Invitation introuvable", "NOT_FOUND");
  }
  if (invitation.status === "accepted") {
    throw new HttpError(409, "Invitation déjà acceptée", "CONFLICT");
  }
  if (invitation.status === "revoked") {
    throw new HttpError(403, "Invitation révoquée", "ADMIN_REQUIRED");
  }
  if (invitation.expiresAt < new Date()) {
    await db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "expired" },
    });
    throw new HttpError(410, "Invitation expirée", "GONE");
  }

  // Check if the user is already a member
  const existingMembership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
  });
  if (existingMembership) {
    // Already a member — just mark as accepted
    await db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date(), acceptedBy: userId },
    });
    return { workspaceId: invitation.workspaceId, role: existingMembership.role as WorkspaceRole };
  }

  // Create membership + mark invitation as accepted
  await db.$transaction([
    db.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      },
    }),
    db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date(), acceptedBy: userId },
    }),
  ]);

  log.info("Workspace invitation accepted", {
    workspaceId: invitation.workspaceId,
    userId,
    role: invitation.role,
  });

  return { workspaceId: invitation.workspaceId, role: invitation.role as WorkspaceRole };
}

/**
 * Remove a member from a workspace.
 * The owner cannot be removed.
 */
export async function removeMember(
  workspaceId: string,
  memberId: string,
  removedBy: string,
): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) throw HttpError.notFound("Workspace");

  if (memberId === workspace.ownerId) {
    throw new HttpError(400, "Le propriétaire ne peut pas être retiré", "VALIDATION_ERROR");
  }

  // Verify the remover is an admin
  const removerMembership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: removedBy } },
  });
  if (!removerMembership || removerMembership.role !== "admin") {
    throw new HttpError(403, "Seuls les administrateurs peuvent retirer des membres", "ADMIN_REQUIRED");
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: memberId } },
  });

  // If the removed user had this workspace as their current, clear it
  await db.userSettings.updateMany({
    where: { userId: memberId, currentWorkspaceId: workspaceId },
    data: { currentWorkspaceId: null },
  });

  log.info("Workspace member removed", { workspaceId, memberId, removedBy });
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  newRole: WorkspaceRole,
  updatedBy: string,
): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) throw HttpError.notFound("Workspace");

  // Verify the updater is an admin
  const updaterMembership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: updatedBy } },
  });
  if (!updaterMembership || updaterMembership.role !== "admin") {
    throw new HttpError(403, "Seuls les administrateurs peuvent modifier les rôles", "ADMIN_REQUIRED");
  }

  // The owner's role cannot be changed
  if (memberId === workspace.ownerId) {
    throw new HttpError(400, "Le rôle du propriétaire ne peut pas être modifié", "VALIDATION_ERROR");
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: memberId } },
    data: { role: newRole },
  });
}

/**
 * List members of a workspace.
 */
export async function listMembers(workspaceId: string, requesterId: string) {
  // Verify the requester is a member
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: requesterId } },
  });
  if (!membership) {
    throw new HttpError(403, "Vous n'êtes pas membre de ce workspace", "ADMIN_REQUIRED");
  }

  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    role: m.role as WorkspaceRole,
    joinedAt: m.joinedAt,
  }));
}

/**
 * List pending invitations for a workspace.
 */
export async function listInvitations(workspaceId: string, requesterId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: requesterId } },
  });
  if (!membership || membership.role !== "admin") {
    throw new HttpError(403, "Seuls les administrateurs peuvent voir les invitations", "ADMIN_REQUIRED");
  }

  return db.workspaceInvitation.findMany({
    where: { workspaceId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(invitationId: string, revokedBy: string): Promise<void> {
  const invitation = await db.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: { workspaceId: true, status: true },
  });
  if (!invitation) throw HttpError.notFound("Invitation");
  if (invitation.status !== "pending") {
    throw new HttpError(400, "L'invitation n'est plus en attente", "VALIDATION_ERROR");
  }

  // Verify the revoker is an admin of the workspace
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: revokedBy } },
  });
  if (!membership || membership.role !== "admin") {
    throw new HttpError(403, "Seuls les administrateurs peuvent révoquer", "ADMIN_REQUIRED");
  }

  await db.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "revoked" },
  });
}
