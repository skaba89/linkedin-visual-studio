-- Phase 4.4 — Team Workspaces
-- Adds Workspace, WorkspaceMember, WorkspaceInvitation tables + a
-- currentWorkspaceId column on UserSettings.

-- ─── UserSettings extension ──────────────────────────────────────────
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "currentWorkspaceId" TEXT;

-- ─── Workspace ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Workspace" (
  "id"          TEXT   NOT NULL,
  "name"        TEXT   NOT NULL,
  "slug"        TEXT   NOT NULL,
  "ownerId"     TEXT   NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key"
  ON "Workspace"("slug");
CREATE INDEX IF NOT EXISTS "Workspace_ownerId_idx"
  ON "Workspace"("ownerId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Workspace_ownerId_fkey'
  ) THEN
    ALTER TABLE "Workspace"
      ADD CONSTRAINT "Workspace_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── WorkspaceMember ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
  "id"           TEXT   NOT NULL,
  "workspaceId"  TEXT   NOT NULL,
  "userId"       TEXT   NOT NULL,
  "role"         TEXT   NOT NULL DEFAULT 'member',
  "invitedBy"    TEXT,
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key"
  ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_role_idx"
  ON "WorkspaceMember"("workspaceId", "role");
CREATE INDEX IF NOT EXISTS "WorkspaceMember_userId_idx"
  ON "WorkspaceMember"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkspaceMember_workspaceId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceMember"
      ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkspaceMember_userId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceMember"
      ADD CONSTRAINT "WorkspaceMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── WorkspaceInvitation ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
  "id"           TEXT   NOT NULL,
  "workspaceId"  TEXT   NOT NULL,
  "email"        TEXT   NOT NULL,
  "role"         TEXT   NOT NULL DEFAULT 'member',
  "token"        TEXT   NOT NULL,
  "invitedBy"    TEXT   NOT NULL,
  "status"       TEXT   NOT NULL DEFAULT 'pending',
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "acceptedAt"   TIMESTAMP(3),
  "acceptedBy"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_token_key"
  ON "WorkspaceInvitation"("token");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_workspaceId_status_idx"
  ON "WorkspaceInvitation"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_email_status_idx"
  ON "WorkspaceInvitation"("email", "status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WorkspaceInvitation_workspaceId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceInvitation"
      ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
