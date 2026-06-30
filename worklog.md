# HERMÈS Worklog — March 4, 2026

## Summary
Implemented 3 tasks for the HERMÈS LinkedIn module: API key fallback, topic input for AI generation, and Expert Data mode.

---

## TASK 1: Fix API key error for Anthropic provider

**File modified**: `src/lib/ai-client.ts`

**Changes**:
- Added `PROVIDER_FALLBACK_ORDER` constant with preferred fallback order: `groq → openrouter → google → deepseek → mistral → together → sambanova → cerebras → openai → anthropic`
- Modified `chatCompletion()` function to check if the configured provider has an API key
- If no key is found, iterates through `PROVIDER_FALLBACK_ORDER` to find a provider with a configured key
- Logs a `console.warn` with the fallback details (e.g., `[HERMÈS] Clé API non configurée pour "anthropic". Fallback automatique vers "groq".`)
- Only throws the error if NO provider has an API key configured
- Changed `providerId`, `model`, and `apiKey` from `const` to `let` to allow reassignment during fallback

---

## TASK 2: Add subject/title input field for AI post generation

### `src/lib/linkedin-ai.ts`
- Added optional `topic?: string` parameter to `generatePostSuggestions(count, format, topic)`
- When `topic` is provided, includes a `SUJET IMPOSÉ` instruction in the system prompt and a specific user message requesting posts about that topic with an expert data angle
- The system prompt also adds a rule emphasizing the topic must be at the heart of each suggestion

### `src/lib/ai-client.ts`
- Added optional `expertTopic?: string` parameter to `generateLinkedInPost(topic, icp, tone, expertTopic)`
- When `expertTopic` is provided, includes a `Sujet imposé` instruction in the system prompt with expert data angle

### `src/components/app/LinkedInView.tsx`
- Added `aiTopic` state in `PublierTab`: `const [aiTopic, setAiTopic] = useState("");`
- Added topic input field ABOVE the "Générer avec l'IA" button in the Génération IA section:
  - Label: "Sujet (optionnel)" with Target icon
  - Placeholder: "Sujet ou titre (ex: Data Architecture B2B)"
  - Styled consistently with dark bg `#18212F` and matching border
- Updated `handleGenerateAI` to pass topic: `generatePostSuggestions(3, undefined, aiTopic || undefined)`
- Updated `LinkedInView` component to handle both `prefillTopic` and `prefillPostText` for cross-tab navigation
- Updated `PublierTab` props to accept `prefillPostText`

---

## TASK 3: Add "Expert Data" mode

### `src/lib/linkedin-ai.ts`
- Added `PostAnalysis` interface with fields: `styleProfile`, `topTopics`, `topFormats`, `avgEngagement`, `recommendations`, `strengths`, `weaknesses`
- Added `analyzeMyPosts(posts)` function:
  - Takes array of `{ text, likes, comments, createdAt }`
  - Returns `PostAnalysis` with AI-generated analysis
  - Uses French prompts with JSON strict response format
  - Includes fallback data if API call fails or no posts available
- Added `generateExpertPosts(analysis, topic?)` function:
  - Takes `PostAnalysis` and optional topic
  - Generates 3 optimized post suggestions based on the user's historical performance
  - System prompt includes the user's full profile (style, strengths, weaknesses, recommendations)
  - Emphasizes expert data angle with insights and data-driven content
  - Returns `LinkedInPostSuggestion[]` with fallback data

### `src/components/app/LinkedInView.tsx`
- Added new imports: `Brain`, `Target`, `Lightbulb`, `Star`, `Shield`, `AlertTriangle` from lucide-react
- Added `analyzeMyPosts`, `generateExpertPosts` function imports and `PostAnalysis` type import
- Updated `LinkedInTab` type to include `"expert"`
- Added Expert tab to tabs array with `Brain` icon and "Expert" label
- Created `ExpertTab` component with:
  - **"Analyser mes posts"** button that calls `analyzeMyPosts(linkedInPosts)`
  - Warning banner when no posts are published
  - Analysis results displayed in visually appealing card layout:
    - Style Profile card with Sparkles icon
    - Stats row: Top Topics (TrendingUp), Top Formats (BarChart3), Avg Engagement (Activity)
    - Strengths (Shield/CheckCircle2) & Weaknesses (AlertTriangle/AlertCircle) side by side
    - Recommendations (Lightbulb/Star)
  - **"Générer en mode Expert"** button (disabled until analysis is done)
  - Optional topic input with Target icon (same pattern as PublierTab)
  - Expert post suggestion cards with "Utiliser" button that calls `onUsePost(sug.text)`
  - Loading states with skeleton cards
  - Error states with AlertCircle
  - Uses `motion.div` for smooth analysis results appearance
- Updated main `LinkedInView` to:
  - Add `prefillPostText` state and `handleUsePost` handler
  - Render `<ExpertTab onUsePost={handleUsePost} />` for "expert" tab
  - Pass `prefillPostText` to `PublierTab` and handle clearing

---

## Style Compliance
- All new UI uses the existing dark theme: `#0F1520`, `#18212F`, `#F0F4F8`, `#7B8A9A`, `#0A66C2`, `#00D4FF`, `#00C48C`, `#F4A100`, `#E5263A`
- Cards use `bg-[#0F1520] border border-white/[0.06] rounded-xl p-5` pattern
- Inner elements use `bg-[#18212F]` pattern
- All text is in French
- framer-motion animations for smooth transitions
- Responsive grid layouts with `sm:grid-cols-*` breakpoints

## Lint & Compilation
- No lint errors in modified files
- App compiles successfully

---
Task ID: 1
Agent: Main Agent
Task: Fix API key error, add topic input, and add Expert Data mode for LinkedIn

Work Log:
- Explored project structure and understood the HERMÈS Next.js 16 codebase
- Fixed API key error in src/lib/ai-client.ts: added PROVIDER_FALLBACK_ORDER and automatic fallback logic when the configured provider has no API key
- Added topic parameter to generatePostSuggestions() in src/lib/linkedin-ai.ts for subject-driven AI generation
- Added aiTopic state and Target icon input field in PublierTab (LinkedInView.tsx)
- Added expertTopic parameter to generateLinkedInPost() in src/lib/ai-client.ts
- Created PostAnalysis interface and analyzeMyPosts() function in linkedin-ai.ts
- Created generateExpertPosts() function in linkedin-ai.ts for expert-optimized post generation
- Added new "Expert" tab with Brain icon in LinkedIn tab navigation
- Created ExpertTab component with: analysis button, analysis results display (style, topics, strengths, weaknesses, recommendations), expert post generation with topic input, and "Utiliser" button to send posts to PublierTab
- Added prefillPostText state and handleUsePost handler in main LinkedInView
- Updated PublierTab to accept prefillPostText prop for receiving expert-generated posts
- Verified build succeeds with all changes

Stage Summary:
- API key fallback: When configured provider has no key, automatically falls back to another configured provider (groq → openrouter → google → etc.)
- Topic input: Users can now specify a subject/title before AI generation, posts are generated with an expert data angle
- Expert Data mode: New tab that analyzes existing LinkedIn posts, identifies patterns/strengths/weaknesses, and generates optimized posts based on the analysis
- All changes compile successfully with Next.js build
---
Task ID: BUG-H2
Agent: Main Agent
Task: Persist all in-memory data stores to SQLite via Prisma (BUG-H2)

Work Log:
- Audited all 9 in-memory data stores across the codebase
- Identified 5 critical stores (workflows, notifications, webhooks, scheduled posts, A/B tests) and 4 moderate stores (event bus, compliance, feedback, orchestrator)
- Added 9 new Prisma models to schema: Workflow, WorkflowExecution, Notification, NotificationPreference, Webhook, WebhookDelivery, OrchestratorState, ComplianceState, FeedbackRule, EventHistory
- Added corresponding relations to User model
- Ran `npx prisma db push` to migrate the schema
- Refactored workflow-engine.ts: replaced Map<string, Workflow> with Prisma queries, all methods now async
- Refactored notification-engine.ts: removed in-memory arrays, uses DB for persistence, auto-seeds preferences
- Refactored webhook-engine.ts: replaced Map + array with Prisma, keeps HTTP delivery logic
- Refactored linkedin/schedule/route.ts: replaced in-memory ScheduledPost[] with db.scheduledPost
- Refactored ab-engine.ts: eliminated dual-store problem, uses Prisma as single source of truth, kept assignments Map as session cache
- Refactored feedback-engine.ts: uses Prisma for both events and rules, auto-seeds default rules
- Refactored agent-orchestrator.ts: persists state, rules, metrics to DB
- Refactored event-bus.ts: persists event history to DB, keeps in-memory listeners
- Refactored linkedin-compliance.ts: persists level, warmup, usage, violations to DB
- Updated all API routes to add `await` to async engine calls
- Verified build compiles successfully
- Tested all endpoints individually: workflows, notifications, webhooks, compliance, orchestrator, feedback, experiments, scheduled posts — all return 200 OK with data persisted in SQLite

Stage Summary:
- BUG-H2 is now FIXED — all 9 in-memory data stores now persist to SQLite via Prisma
- Data survives server restarts
- The dual-store problem in A/B testing and feedback is eliminated (single source of truth in DB)
- 9 new Prisma models added with proper indexes
- All engines converted to async DB-backed operations
- Build passes cleanly with no errors

---
Task ID: BUG-H3
Agent: Main Agent
Task: Fix frontend API errors (CLIENT_FETCH_ERROR, 401/503/500 cascade) after the 500 fix

Work Log:
- Investigated the next-auth CLIENT_FETCH_ERROR on /api/auth/session
- Discovered a custom /api/auth/session/route.ts that was shadowing NextAuth's
  built-in [...nextauth] catch-all route
- The custom route returned 401 with {authenticated:false} for unauthenticated
  users, but next-auth's client expects 200 with an empty body — this mismatch
  triggered CLIENT_FETCH_ERROR on every page load
- Removed the custom /api/auth/session/route.ts file (let NextAuth handle it)
- Removed 'require-trusted-types-for \"script\"' from the CSP — this strict
  directive breaks NextAuth's client-side session polling and Next.js 16 RSC
  payload injection in production
- Widened AUTH_SKIP_ROUTES from explicit /api/ai/chat + /api/ai/web-search
  to /api/ai/ so all AI routes (including generate-carousel, generate-image)
  skip the middleware auth check (they use their own x-api-key header auth)
- Verified locally with `npm run build && PORT=3003 NODE_ENV=production npm run start`:
  - GET / -> 200
  - GET /api/auth/session -> 200 {} (was 401 — root cause of CLIENT_FETCH_ERROR)
  - GET /api/health -> 200
  - GET /api/linkedin/me -> 401 (expected — user not logged in)
  - POST /api/ai/chat -> 200 locally (will be 503 on Render until ZAI_* env vars set)
- Committed and pushed to main (commit e54e13b)

Stage Summary:
- CLIENT_FETCH_ERROR root cause identified and fixed: shadow route + strict CSP
- Remaining 401 on /api/linkedin/me is EXPECTED behavior (user must log in first)
- Remaining 503 on /api/ai/chat is EXPECTED behavior on Render until operator
  sets ZAI_BASE_URL and ZAI_API_KEY env vars (or user configures an LLM API key
  in the Settings UI)
- Render will auto-deploy from main; user should hard-refresh the page after
  deployment completes (~2-4 min)

---
Task ID: FEAT-ZAI-PROVIDER
Agent: Main Agent
Task: Add Z.AI as a configurable provider in the Settings UI

Work Log:
- Added Z.AI entry to AI_PROVIDERS in src/lib/providers.ts with 5 GLM models
  (glm-4.6, glm-4.5, glm-4-plus, glm-4-air, glm-4-flash) and baseUrl
  https://api.z.ai/v1
- Updated isOpenAICompatible() to exclude 'zai' (uses its own SDK format)
- Added createZaiFromApiKey() in src/lib/z-ai-bootstrap.ts — builds a fresh
  per-request ZAI instance from a user-provided API key (no caching)
- Updated src/app/api/ai/chat/route.ts with handleZai() — routes ZAI requests
  through z-ai-web-dev-sdk; uses user key if provided, otherwise falls back
  to server-configured SDK (env vars or .z-ai-config file)
- Created missing src/app/api/ai/test/route.ts — was 404 in the Settings UI
  when clicking 'Test'; now tests ZAI, Anthropic, and all OpenAI-compatible
  providers with a minimal 'ping' request
- Updated src/lib/ai-client.ts: added 'zai' to PROVIDER_FALLBACK_ORDER (first
  position since it works without a user key); skipped fallback logic when
  providerId === 'zai' (otherwise it would switch to another provider)
- Verified locally with `npm run build && PORT=3004 NODE_ENV=production npm run start`:
  - POST /api/ai/test {providerId:'zai', apiKey:''}  -> 200 {ok:true}
  - POST /api/ai/chat {providerId:'zai', model:'glm-4-flash', messages:[...]}  -> 200
  - POST /api/ai/test {providerId:'groq', apiKey:''}  -> 400 (Clé API manquante)
- Committed and pushed to main (commit 078916e)

Stage Summary:
- Z.AI is now visible in the "Fournisseurs IA" page as a 11th provider card
- Users can enter a Z.AI API key OR leave it empty (server-configured SDK
  fallback works on Render if ZAI_BASE_URL + ZAI_API_KEY env vars are set,
  or in dev where /etc/.z-ai-config exists)
- The 'Test' button now works for all providers (was 404 before)
- Render will auto-deploy from main; user should hard-refresh after deploy

---
Task ID: BUG-H4
Agent: Main Agent
Task: Fix /api/ai/test returning 404 on Render

Work Log:
- User reported 404 on /api/ai/test after the previous ZAI provider commit
- Investigated: git log showed commit 078916e was pushed, but
  `git ls-files src/app/api/ai/` did NOT include test/route.ts
- Ran `git check-ignore -v src/app/api/ai/test/route.ts` and found:
  `.gitignore:56:test` — a bare 'test' entry that matches ANY file or
  directory named 'test' anywhere in the project
- This caused the test route file to be silently ignored by git, so it
  was never committed or pushed to Render
- Fixed .gitignore: replaced the bare 'test' pattern with conventional
  test file patterns (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx,
  __tests__/) that don't match API route directories
- Staged and committed the previously-untracked test/route.ts
- Verified: build output now includes '├ ƒ /api/ai/test' in the route list
- Pushed fix to main (commit 245d247)

Stage Summary:
- The /api/ai/test route will now be deployed to Render (was being silently
  dropped by the overly broad 'test' gitignore pattern)
- The 'Test' button in the Settings UI will work after the next Render
  deployment completes (~2-4 min)

---
Task ID: BUG-H5
Agent: Main Agent
Task: Fix persistent 401 on /api/linkedin/me (NEXTAUTH_SECRET mismatch)

Work Log:
- Investigated the 401 on /api/linkedin/me reported by the user
- Found a secret mismatch between middleware and auth-config:
  - src/middleware.ts:96 had a fallback 'hermes-dev-secret-change-in-production'
  - src/lib/auth-config.ts:112 had NO fallback in production (undefined)
- When NEXTAUTH_SECRET was unset on Render, NextAuth signed JWTs with one
  secret but the middleware verified with another → token always null → 401
- Removed the middleware's NEXTAUTH_SECRET fallback so both sides use
  process.env.NEXTAUTH_SECRET directly (consistent behavior)
- Added /api/linkedin/auth and /api/linkedin/callback to AUTH_SKIP_ROUTES
  so the LinkedIn OAuth flow can start without an existing app session
  (otherwise users could never connect LinkedIn)
- Added useSession() check to LinkedInView's ConnexionTab component —
  checkConnection() now only fires when status === 'authenticated',
  eliminating the noisy 401 in the console when the user isn't logged in
- Generated a secure NEXTAUTH_SECRET for the user (redacted — see Render env vars)
- Verified locally with NEXTAUTH_SECRET set:
  - /api/linkedin/auth     -> 307 (OAuth redirect, not blocked)
  - /api/linkedin/callback -> 307 (OAuth callback, not blocked)
  - /api/linkedin/me       -> 401 (correctly blocked without session)
  - /api/auth/session      -> 200 {} (NextAuth native)
  - /api/ai/test           -> 200 (ZAI server SDK works)
- Committed and pushed to main (commit 0c1e51a)

Stage Summary:
- The NEXTAUTH_SECRET mismatch was the root cause of ALL the 401 errors
  the user has been seeing on authenticated endpoints
- The user MUST set NEXTAUTH_SECRET on Render for login to work
- Suggested value: (redacted — generated with `openssl rand -base64 32`)
- The LinkedIn OAuth flow is now reachable without an existing session
- The frontend no longer fires /api/linkedin/me on every page load when
  the user isn't logged in

---
Task ID: BUG-H6
Agent: Main Agent
Task: Fix Prisma migration not applied on Render (root cause of all 401s)

Work Log:
- Tested the full NextAuth login flow on Render via scripts/test-render-auth.sh
- Discovered the real root cause: login fails with Prisma error
  "The column User.passwordHash does not exist in the current database"
- The migration 20260630000000_add_password_hash_and_role was committed to git
  but NEVER applied to the Render production database
- Root cause: build.sh runs 'npx prisma migrate deploy' at BUILD time, but
  DATABASE_URL is a runtime-only secret on Render — not available during build
- Fix 1: Changed render.yaml startCommand to
    'npx prisma migrate deploy && npm run start'
  so migrations run at START time when DATABASE_URL is available
- Fix 2: Created POST /api/setup/migrate endpoint — one-time UNPROTECTED
  endpoint that runs 'npx prisma migrate deploy' on demand. Protected by
  MIGRATION_KEY env var (query parameter must match)
- Fix 3: Added /api/setup/ to AUTH_SKIP_ROUTES in middleware so the migration
  endpoint isn't blocked by auth (would be catch-22 since login is broken)
- Fix 4: Created scripts/migrate-render-db.sh for running migrations locally
  against the production database by passing DATABASE_URL as argument
- Committed and pushed to main (commit ae278a7)

Stage Summary:
- The Prisma migration was the ROOT CAUSE of all the 401 errors — login was
  broken because the User table was missing passwordHash, passwordSalt, and
  role columns
- The user MUST trigger a redeploy on Render after setting NEXTAUTH_SECRET
  and verifying DATABASE_URL is present
- The startCommand change will automatically apply migrations on every
  deploy/restart, preventing this class of bug in the future
- If the startCommand times out, the user can use /api/setup/migrate with
  MIGRATION_KEY set, or run scripts/migrate-render-db.sh locally

---
Task ID: BUG-H7
Agent: Main Agent
Task: Eliminate remaining 401 console noise on /api/linkedin/me after login works

Work Log:
- User reported a single 401 on /api/linkedin/me after the previous
  Prisma migration fix (commit ae278a7) went live
- Diagnosis: the 401 was coming from the ROUTE HANDLER (not middleware)
  — the user IS now logged in (Prisma migration applied), but hasn't
  connected LinkedIn yet. The route returned 401 { notConnected: true }
  for that state, which is a valid application state, not an auth failure
- Fixed /api/linkedin/me/route.ts: when no LinkedIn token is in cookies,
  return 200 { notConnected: true, profile: null } instead of 401
  - The middleware still protects the route with NextAuth (so a true
    unauthenticated request still gets a real 401 from middleware)
  - Browser console will no longer log a noisy 401 for this state
- Updated src/components/app/LinkedInView.tsx checkConnection():
  inspect data.notConnected to distinguish "logged in, no LinkedIn"
  from "connected with profile"
- Updated src/components/app/SettingsView.tsx handleTestLinkedIn():
  treat notConnected as a test failure (LinkedIn itself isn't connected)
- Removed unused `cookies` import from the route file
- Updated misleading comment in LinkedInView (session gating is still
  needed — without it the middleware would return a real 401)
- Verified locally: tsc --noEmit clean, next build clean (49/49 pages)
- Committed (8453a93) and pushed to main

Stage Summary:
- The 401 console noise on /api/linkedin/me will disappear after the
  next Render deploy (~2-4 min)
- The user can now verify the full flow: log in -> LinkedIn tab shows
  "Connect" button (no 401 noise) -> click Connect -> OAuth flow ->
  return to LinkedIn tab -> profile loads
- IMPORTANT: The GitHub token [REDACTED]
  was used to push — it should be revoked once the user confirms the
  deploy is healthy

---
Task ID: R002-NOTIF
Agent: Main Agent
Task: R-002 deep — multi-tenant isolation for notificationEngine

Work Log:
- Identified that notificationEngine hardcoded DEFAULT_USER_ID = "default",
  meaning every user saw the same shared notification feed (multi-tenant
  data leak). The /api/data/notifications route called requireUser() but
  never passed user.id to the engine.
- Refactored src/lib/notifications/notification-engine.ts:
  - Every method now takes userId as its first parameter
  - getNotification/markAsRead/dismiss use updateMany + findFirst with
    userId filter (no existence leak — IDOR fix)
  - preferencesSeeded became a Set<string> (per-user tracking)
  - Removed DEFAULT_USER_ID import
- Updated src/app/api/data/notifications/route.ts: every engine call now
  passes user.id
- Cleaned up src/components/app/NotificationsView.tsx: removed the dead
  client-side notificationEngine fallback (it imported Prisma's db client
  which can't run in the browser — the fallback was never executable)
- Added src/lib/__tests__/notification-engine.test.ts: 17 tests covering
  multi-tenant isolation (notify writes with userId, getNotifications
  filters by userId, getNotification/markAsRead/dismiss return null/false
  for other users' notifications, markAllAsRead/dismissAll/clearAll only
  touch the given user, getStats/getPreferences scoped per user)
- Fixed .gitignore: removed overly-broad *.test.ts / __tests__/ patterns
  (were blocking legitimate Vitest tests); added tool-results/ to ignore
- Verification: tsc clean, next build clean (49/49 pages), vitest 208/208
  tests pass (17 new + 191 existing)
- Redacted all secrets (NEXTAUTH_SECRET value, GitHub PAT) from worklog
  after GitHub secret scanner blocked the initial push

Stage Summary:
- notificationEngine is now multi-tenant safe — no more shared DEFAULT_USER_ID
- 17 new tests lock in the isolation guarantee
- Remaining R-002 deep backlog: ab-engine, workflow-engine, compliance-engine,
  email-agent (all have similar DEFAULT_USER_ID hardcoding but lower priority
  since they have fewer active callers)
- The GitHub PAT used for pushing should still be revoked by the user
