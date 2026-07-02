-- Phase 3 — Engagement Intelligence
-- Adds 4 new tables (LinkedInReactor, TrendingTopic, ProfileVisitor, ExpertComment)
-- and extends UserSettings with engagement preferences.

-- ─── UserSettings extension ──────────────────────────────────────────
ALTER TABLE "UserSettings"
  ADD COLUMN "engagementAutoReply"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "engagementMaxDailyComments" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "engagementTone"            TEXT    NOT NULL DEFAULT 'expert',
  ADD COLUMN "engagementMinHoursBetween" DOUBLE PRECISION NOT NULL DEFAULT 2;

-- ─── LinkedInReactor ─────────────────────────────────────────────────
CREATE TABLE "LinkedInReactor" (
  "id"                  TEXT   NOT NULL,
  "userId"              TEXT   NOT NULL,
  "postUrn"             TEXT   NOT NULL,
  "postId"              TEXT,
  "reactorLinkedInId"   TEXT   NOT NULL,
  "reactorName"         TEXT   NOT NULL DEFAULT '',
  "reactorHeadline"     TEXT,
  "reactorProfileUrl"   TEXT,
  "reactorAvatarUrl"    TEXT,
  "action"              TEXT   NOT NULL,
  "commentText"         TEXT,
  "commentUrn"          TEXT,
  "capturedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncedToCrmAt"       TIMESTAMP(3),
  "contactId"           TEXT,
  "ignored"             BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LinkedInReactor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkedInReactor_userId_postUrn_reactorLinkedInId_actio_key"
  ON "LinkedInReactor"("userId", "postUrn", "reactorLinkedInId", "action");
CREATE INDEX "LinkedInReactor_userId_action_idx"
  ON "LinkedInReactor"("userId", "action");
CREATE INDEX "LinkedInReactor_userId_syncedToCrmAt_idx"
  ON "LinkedInReactor"("userId", "syncedToCrmAt");
CREATE INDEX "LinkedInReactor_userId_capturedAt_idx"
  ON "LinkedInReactor"("userId", "capturedAt");

ALTER TABLE "LinkedInReactor"
  ADD CONSTRAINT "LinkedInReactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedInReactor"
  ADD CONSTRAINT "LinkedInReactor_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
  MATCH FULL;

-- ─── TrendingTopic ───────────────────────────────────────────────────
CREATE TABLE "TrendingTopic" (
  "id"                TEXT   NOT NULL,
  "userId"            TEXT   NOT NULL,
  "topic"             TEXT   NOT NULL,
  "angle"             TEXT   NOT NULL DEFAULT '',
  "heat"              TEXT   NOT NULL DEFAULT 'warm',
  "suggestedHook"     TEXT   NOT NULL DEFAULT '',
  "sourceUrl"         TEXT,
  "detectedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"            TEXT   NOT NULL DEFAULT 'new',
  "targetPostUrn"     TEXT,
  "targetPostExcerpt" TEXT,
  "commentText"       TEXT,
  "commentUrn"        TEXT,
  "postedAt"          TIMESTAMP(3),
  "error"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrendingTopic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrendingTopic_userId_status_idx"
  ON "TrendingTopic"("userId", "status");
CREATE INDEX "TrendingTopic_userId_detectedAt_idx"
  ON "TrendingTopic"("userId", "detectedAt");

ALTER TABLE "TrendingTopic"
  ADD CONSTRAINT "TrendingTopic_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ProfileVisitor ──────────────────────────────────────────────────
CREATE TABLE "ProfileVisitor" (
  "id"                TEXT   NOT NULL,
  "userId"            TEXT   NOT NULL,
  "visitorName"       TEXT   NOT NULL,
  "visitorHeadline"   TEXT,
  "visitorProfileUrl" TEXT,
  "visitedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source"            TEXT   NOT NULL DEFAULT 'manual',
  "note"              TEXT,
  "syncedToCrmAt"     TIMESTAMP(3),
  "contactId"         TEXT,
  "ignored"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfileVisitor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileVisitor_userId_visitedAt_idx"
  ON "ProfileVisitor"("userId", "visitedAt");
CREATE INDEX "ProfileVisitor_userId_syncedToCrmAt_idx"
  ON "ProfileVisitor"("userId", "syncedToCrmAt");

ALTER TABLE "ProfileVisitor"
  ADD CONSTRAINT "ProfileVisitor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileVisitor"
  ADD CONSTRAINT "ProfileVisitor_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
  MATCH FULL;

-- ─── ExpertComment ───────────────────────────────────────────────────
CREATE TABLE "ExpertComment" (
  "id"                TEXT   NOT NULL,
  "userId"            TEXT   NOT NULL,
  "source"            TEXT   NOT NULL DEFAULT 'trending',
  "trendingTopicId"   TEXT,
  "reactorId"         TEXT,
  "targetPostUrn"     TEXT   NOT NULL,
  "targetPostExcerpt" TEXT   NOT NULL DEFAULT '',
  "commentText"       TEXT   NOT NULL,
  "tone"              TEXT   NOT NULL DEFAULT 'expert',
  "model"             TEXT   NOT NULL DEFAULT '',
  "status"            TEXT   NOT NULL DEFAULT 'generated',
  "commentUrn"        TEXT,
  "postedAt"          TIMESTAMP(3),
  "error"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpertComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpertComment_userId_status_idx"
  ON "ExpertComment"("userId", "status");
CREATE INDEX "ExpertComment_userId_createdAt_idx"
  ON "ExpertComment"("userId", "createdAt");
CREATE INDEX "ExpertComment_userId_source_idx"
  ON "ExpertComment"("userId", "source");

ALTER TABLE "ExpertComment"
  ADD CONSTRAINT "ExpertComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
