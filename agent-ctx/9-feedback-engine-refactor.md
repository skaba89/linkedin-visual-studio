# Task 9 — Refactor Feedback Engine to Persist via Prisma

## Summary
Eliminated the dual-store problem where `FeedbackEngine` stored `feedbackHistory` and `rules` in memory while the API route also wrote to `db.feedbackEvent`. All state now persists to SQLite via Prisma.

## Changes Made

### `/home/z/my-project/src/lib/feedback/feedback-engine.ts`
- **Removed** `private feedbackHistory` and `private rules` in-memory stores
- **Added** `import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db"`
- **Added** `mapDbRuleToFeedbackRule()` helper to map Prisma `FeedbackRule` rows → `FeedbackRule` interface
- **`recordFeedback()`** → now `async`, creates `db.feedbackEvent.create()` internally and returns `Promise<FeedbackInsight>`
- **`getInsights()`** → now `async`, queries `db.feedbackEvent.findMany()` ordered by `createdAt desc`
- **`getRules()`** → now `async`, queries `db.feedbackRule.findMany()`, seeds from `DEFAULT_RULES` if table is empty
- **`toggleRule()`** → now `async`, updates via `db.feedbackRule.update()` using compound unique key `userId_ruleId`
- **`getAgentPerformance()`** → now `async`, queries `db.feedbackEvent.findMany()` for the agent
- **`getDashboardData()`** → now `async`, uses `Promise.all` for agent performance queries and DB for recent actions
- **Removed** `loadFeedbackData()` (no longer needed with DB persistence)
- **`evaluateRules()`** → signature changed to accept `rules: FeedbackRule[]` parameter instead of reading `this.rules`; core logic unchanged
- **Kept as-is**: `calculateBaseline()`, `generateRecommendation()`, `calculatePriority()`
- **Kept**: `AGENT_NAMES` map, `FeedbackEngine` class, `feedbackEngine` singleton export

### `/home/z/my-project/src/app/api/data/feedback/route.ts`
- **GET**: added `await` to all `feedbackEngine` calls
- **POST**: removed the separate `db.feedbackEvent.create()` since `recordFeedback()` now handles DB write internally; added `await` to `feedbackEngine.recordFeedback()`

## Lint & Dev Server
- No lint errors in modified files
- Dev server compiles and runs without errors
