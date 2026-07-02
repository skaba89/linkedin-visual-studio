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

---
Task ID: R-009-bis
Agent: Main Agent
Task: R-009-bis — Fix production build failure on origin/main (Prisma client out of sync + missing emailVerified migration)

Work Log:
- Aligné le local sur origin/main (commit 9129eee) — récupère les 98 commits remote critiques (R-003, R-004, R-005/R-008, R-007, R-002, fixes production linkedin/me, migrations DB, NEXTAUTH_SECRET, etc.)
- Diagnostic build : `next build` échouait avec 30 erreurs TypeScript :
  - "Type 'string | null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'" sur ab-engine, notification-engine, webhook-engine, event-bus
  - "Object literal may only specify known properties, and 'emailVerified' does not exist in type 'UserSelect'" sur auth-config.ts et session.ts
  - "Argument of type 'JsonValue' is not assignable to parameter of type 'string'" sur email-agent, workflow-engine
- Cause racine : le client Prisma généré dans node_modules/.prisma/client était obsolète
  - Le schema Prisma déclarait `emailVerified DateTime?` sur User (ajouté dans R-001 pour NextAuth)
  - Mais le client généré ne contenait PAS `emailVerified` (généré avant l'ajout du champ)
  - Le client généré avait aussi `metadata: JsonValue | null` pour ExperimentResult alors que le schema dit `metadata String?` (génération à partir d'un état intermédiaire du schema)
  - Conséquence : types mismatch partout → build casse
- Fix 1 : `npx prisma generate` — régénère le client depuis le schema actuel
  - Vérifié : `emailVerified: Date | null` présent, `metadata: FieldRef<"ExperimentResult", 'String'>` correct
  - Résultat : `tsc --noEmit` → 0 erreur, `next build` → ✓ Compiled successfully
- Fix 2 : Créé la migration SQL manquante `prisma/migrations/20260701000000_add_email_verified/migration.sql`
  - Raison : le champ `emailVerified` était dans le schema Prisma mais PAS dans les migrations SQL
  - Le `startCommand` de render.yaml fait `npx prisma migrate deploy` au démarrage, mais cette commande n'applique que les migrations existantes
  - Sans cette migration, la DB Neon n'aurait jamais eu la colonne `emailVerified`, et NextAuth aurait crashé à runtime en prod
  - La migration est idempotente (`ADD COLUMN IF NOT EXISTS`) — safe à re-run

Stage Summary:
- R-009-bis COMPLÉTÉ — le build de production passe sur origin/main
- Le client Prisma est régénéré (local + postinstall hook sur Render)
- La migration `emailVerified` est créée — sera appliquée au prochain déploiement Render via `prisma migrate deploy`
- Build : ✓ Compiled successfully in 6.0s, 49/49 static pages
- TypeScript : 0 erreur
- Tests : 208/208 passent (9 fichiers)
- Le déploiement Render devrait maintenant réussir sans erreur de build ni erreur runtime NextAuth

---
Task ID: R-010
Agent: Main Agent
Task: R-010 — Fix LinkedIn OAuth redirect to 0.0.0.0:10000 + "Connexion requis" error on Render

Work Log:
- Symptômes rapportés par l'utilisateur :
  - URL d'erreur : `https://0.0.0.0:10000/?linkedin=error&message=Connexion+requis+avant+de+lier+votre+compte+LinkedIn`
  - Browser : `ERR_ADDRESS_INVALID`
- Deux bugs distincts identifiés :

BUG 1 : `0.0.0.0:10000` dans les URLs de redirect
- Cause : Les routes LinkedIn utilisaient `new URL(path, request.url)` et `${request.nextUrl.protocol}//${request.nextUrl.host}` pour construire les URLs de redirect
- Sur Render, le serveur Next.js bind sur `0.0.0.0:10000` derrière un reverse proxy. `request.url` et `request.nextUrl.host` reflètent l'adresse interne, pas l'URL publique
- Conséquence : tous les redirects (erreur ET succès) pointaient vers `https://0.0.0.0:10000/...` → le browser ne peut pas résoudre cette adresse → ERR_ADDRESS_INVALID
- Fix : Créé `src/lib/app-url.ts` avec deux helpers :
  - `appUrl(request)` — résout l'URL publique avec priorité : NEXTAUTH_URL env > NEXT_PUBLIC_APP_URL env > X-Forwarded-Host header > request.nextUrl (fallback dev)
  - `appUrlFor(request, path)` — construit une URL absolue à partir d'un path
- Migré `src/app/api/linkedin/callback/route.ts` (11 occurrences) :
  - Tous les `new URL("/?linkedin=error&...", request.url)` → `appUrlFor(request, "/?linkedin=error&...")`
  - `defaultRedirectUri = \`${request.nextUrl.protocol}//${request.nextUrl.host}/api/linkedin/callback\`` → `\`${appUrl(request)}/api/linkedin/callback\``
- Migré `src/app/api/linkedin/auth/route.ts` (4 occurrences) :
  - `origin` fallback → `appUrl(request)` au lieu de `\`${request.nextUrl.protocol}//${request.nextUrl.host}\``
  - Tous les `new URL(..., request.url)` → `appUrlFor(request, ...)`

BUG 2 : "Connexion requis avant de lier votre compte LinkedIn"
- Cause : `requireUser()` échouait sur le callback LinkedIn car `getServerSession()` retournait null
- Investigation : NextAuth v4.24.13 `detectOrigin()` dans `node_modules/next-auth/utils/detect-origin.js` :
  ```js
  if (process.env.VERCEL ?? process.env.AUTH_TRUST_HOST)
    return `${protocol}://${forwardedHost}`;  // trust X-Forwarded-Host
  return process.env.NEXTAUTH_URL;            // fallback to env var
  ```
- Sur Render : `VERCEL` n'est pas set, `AUTH_TRUST_HOST` n'était pas set non plus
- Si `NEXTAUTH_URL` était manquant ou mal configuré dans le dashboard Render, NextAuth ne pouvait pas déterminer l'origine → session cookie mal set → `getServerSession()` retourne null sur le callback LinkedIn
- Fix : Ajouté `AUTH_TRUST_HOST=true` à `render.yaml` (env var au runtime)
  - Provoque NextAuth à utiliser `X-Forwarded-Host` header (set par Render's proxy à l'URL publique)
  - Plus robuste que NEXTAUTH_URL seule : fonctionne même si NEXTAUTH_URL a un typo ou est manquant
  - `NEXTAUTH_URL` reste nécessaire pour le helper `appUrl()` (routes LinkedIn) — les deux sont complémentaires
- Note : `trustHost: true` dans auth-config.ts ne fonctionne PAS en v4 (c'est une option v5/Auth.js). Retiré après vérification TypeScript.

Stage Summary:
- R-010 COMPLÉTÉ — les deux bugs LinkedIn OAuth sur Render sont fixés
- Bug 1 (0.0.0.0:10000) : résolu via helper `appUrl()`/`appUrlFor()` qui préfère NEXTAUTH_URL env var
- Bug 2 (Connexion requis) : résolu via `AUTH_TRUST_HOST=true` qui permet à NextAuth de lire X-Forwarded-Host
- Build : ✓ Compiled successfully in 5.4s, 49/49 static pages
- TypeScript : 0 erreur
- Tests : 208/208 passent
- render.yaml mis à jour avec AUTH_TRUST_HOST=true (sera appliqué au prochain déploiement Render)
- ATTENTION : l'utilisateur doit vérifier que NEXTAUTH_URL est bien set dans le dashboard Render (sync: false = manuel)

---
Task ID: R-010-deep
Agent: Main Agent
Task: R-010 deep — Force AUTH_TRUST_HOST + Host header fallback (after R-010 v1 was insufficient on Render)

Work Log:
- Symptôme : utilisateur rapporte toujours l'erreur `https://0.0.0.0:10000/?linkedin=error&message=Connexion+requis+avant+de+lier+votre+compte+LinkedIn` après le déploiement de R-010 v1 (commit cd786bb)
- Investigation : R-010 v1 a ajouté `AUTH_TRUST_HOST=true` à render.yaml, mais Render n'applique PAS les changements de render.yaml aux services EXISTANTS (seulement aux nouveaux services créés depuis le blueprint). Donc le service en production n'avait toujours pas AUTH_TRUST_HOST.
- Cascade d'échecs identifiée :
  1. NextAuth `detectOrigin()` tombe sur `AUTH_TRUST_HOST` non set → fallback à `NEXTAUTH_URL` env var
  2. `NEXTAUTH_URL` non set sur Render dashboard (sync: false = manuel)
  3. → `getServerSession()` retourne null sur le callback LinkedIn
  4. → `requireUser()` throw → callback redirect vers `/?linkedin=error&...`
  5. → `appUrl()` n'avait ni env var, ni `X-Forwarded-Host` → fallback à `request.nextUrl.host` = `0.0.0.0:10000`
  6. → Browser reçoit `Location: https://0.0.0.0:10000/?linkedin=error&...`
  7. → `ERR_ADDRESS_INVALID`

- Fix triple (défense en profondeur — fonctionne même si le dashboard Render est mal configuré) :

  1. `src/lib/auth-config.ts` — force-set `process.env.AUTH_TRUST_HOST = "true"` en production au chargement du module. NextAuth v4 `detectOrigin()` lit cette env var à runtime, donc la setter programmatiquement avant l'init NextAuth fait marcher la session sur le proxy Render quel que soit le config du dashboard.

  2. `src/lib/app-url.ts` — ajout du header `Host` comme fallback entre `X-Forwarded-Host` et `request.nextUrl`. Ajout de `isInternalHost()` pour skip les hosts internes (0.0.0.0, 127.0.0.1, 10.x, 192.168.x, etc.) afin de ne jamais utiliser l'adresse interne Render par accident.

  3. `src/instrumentation.ts` + `src/instrumentation-node.ts` — restauré le filet de sécurité R-005 (perdu lors d'un sync git précédent) + log des env vars critiques au boot pour faciliter le debug depuis les logs Render.

  4. `src/app/api/linkedin/callback/route.ts` — log diagnostic info (env vars, headers, nextUrl) quand `requireUser()` échoue, pour identifier la cause exacte depuis les logs Render sans SSH.

  5. `src/lib/__tests__/app-url.test.ts` — nouvelle suite de tests (10 tests) couvrant tous les niveaux de priorité et l'invariant critique 'ne jamais retourner 0.0.0.0'.

- Vérifications :
  - tsc --noEmit : 0 erreur
  - next build : ✓ Compiled successfully in 5.6s, 49/49 static pages
  - vitest : 218/218 tests passent (208 existants + 10 nouveaux)
  - Push : commit 29cd0c1 poussé sur origin/main (Render va auto-déployer)

Stage Summary:
- R-010 deep COMPLÉTÉ — trois couches de défense pour l'OAuth LinkedIn sur Render
- Layer 1 (code) : AUTH_TRUST_HOST force-set en production → NextAuth trust X-Forwarded-Host quel que soit le dashboard
- Layer 2 (code) : appUrl() utilise Host header en fallback + skip internal hosts → jamais de 0.0.0.0:10000 dans les redirects
- Layer 3 (code) : instrumentation restaurée + logs diagnostic au boot et dans le callback
- L'utilisateur N'A PAS BESOIN de configurer NEXTAUTH_URL ou AUTH_TRUST_HOST sur le dashboard Render pour que ça marche (mais c'est recommandé pour la robustesse)
- Action utilisateur requise : attendre le déploiement Render (2-3 min), puis réessayer la connexion LinkedIn

---
Task ID: R-011-deep-v4
Agent: Main Agent
Task: R-011 deep v4 — Synchronous migration at boot + self-healing login (after confirming production DB is missing User.passwordHash)

Work Log:
- User shared Render settings screenshot showing:
  - Pre-Deploy Command: locked (not editable from UI)
  - Start Command: `npm run start` (NOT `bash start.sh` from render.yaml)
  - Auto-Deploy: On Commit
- This means Render was set up MANUALLY (not from render.yaml blueprint), so
  render.yaml's `startCommand: bash start.sh` is NOT applied to the existing
  service. Migrations never run on Render because `npm run start` just runs
  `next start` directly.

- Confirmed production DB state via direct login test:
  POST /api/auth/callback/credentials with demo@hermes.app / Demo-Hermes-2024
  → HTTP 401 with error: "The column `User.passwordHash` does not exist in
    the current database"
  → Prisma crashes when querying a non-existent column
  → No session cookie is ever set
  → LinkedIn OAuth callback → requireUser() → null → "Connexion requis"

- Confirmed Render auto-deploy is STUCK:
  - Latest commit on GitHub: 1c9d4d0 (pushed)
  - /api/setup/ensure-user-columns → HTTP 404 (endpoint doesn't exist on prod)
  - /api/health → no DB schema diagnostics (older version deployed)
  - The deployed version is somewhere between 5ff2a30 (R-011 demo password fix)
    and e13a0ec (R-011 deep v3 — health diagnostics)

- Confirmed MIGRATION_KEY env var is NOT set on Render:
  POST /api/setup/migrate → 503 "MIGRATION_KEY env var not set"
  → The deployed /api/setup/migrate endpoint is useless without the key

- FIXES (3 layers of defense-in-depth):

  1. instrumentation-node.ts — make migration SYNCHRONOUS (awaited)
     - Was: ensureUserColumns().catch(...)  (fire-and-forget)
     - Now: await ensureUserColumns() inside initInstrumentation()
     - register() in instrumentation.ts now AWAITS initInstrumentation()
     - Result: Next.js will NOT accept requests until schema is ready
     - Eliminates the race condition where first login at boot failed

  2. auth-config.ts ensureDemoUser() — self-healing migration
     - If findUnique() throws 'column does not exist', run
       ensureUserColumns() and retry the query once

  3. auth-config.ts authorize() — self-healing migration on login
     - Same pattern: if user lookup throws 'column does not exist',
       run ensureUserColumns() and retry once
     - This is the LAST line of defense — even if instrumentation AND
       ensureDemoUser both failed, the login will self-heal

- Verified:
  - tsc --noEmit: 0 errors
  - next build: Compiled successfully, 49/49 pages
  - vitest: 224/224 tests pass
  - Push: commit 1c9d4d0 pushed to origin/main

Stage Summary:
- R-011 deep v4 COMPLÉTÉ — 3 layers of self-healing migration
- After this commit deploys, login will work even if the DB is missing
  User columns — the first login attempt will trigger the migration
- USER ACTION REQUIRED (auto-deploy is stuck):
  1. Go to Render dashboard → hermes-app service
  2. Click "Manual Deploy" → "Deploy latest commit"
  3. Wait 2-5 minutes for the build to complete
  4. Try to log in with demo@hermes.app / Demo-Hermes-2024
  5. Then try to connect LinkedIn
- RECOMMENDED (for future deploys):
  - Change Start Command from `npm run start` to `bash start.sh`
    (so prisma migrate deploy runs on every future deploy)
  - OR set NEXTAUTH_URL=https://linkedin-visual-studio.onrender.com
    and AUTH_TRUST_HOST=true on the Render dashboard (belt + suspenders)

---
Task ID: R-011-deep-v7-audit
Agent: Main Agent
Task: Audit end-to-end complet après déploiement de R-011 deep v6

Work Log:
- Créé script /home/z/my-project/scripts/e2e-audit.sh qui teste 19 points :
  1. Version déployée (présence du fix role enum → TEXT)
  2. Schéma DB (colonnes User via /api/health)
  3. Variables env (NEXTAUTH_SECRET, URL, AUTH_TRUST_HOST, ENCRYPTION_KEY)
  4. Endpoints NextAuth (CSRF, providers, session)
  5. Login flow complet (CSRF → POST credentials → cookie session)
  6. Session après login (GET /api/auth/session avec cookies)
  7. LinkedIn OAuth (GET /api/linkedin/auth avec session)
  8. Routes protégées (GET /api/linkedin/me avec session)
  9. Headers de sécurité (CSP, HSTS)

- RÉSULTAT : 17/19 tests passent ✅

- SUCCÈS MAJEUR :
  - Login demo@hermes.app / Demo-Hermes-2024 FONCTIONNE (HTTP 200 + cookie session)
  - /api/auth/session retourne user complet avec id, role, email
  - /api/linkedin/me accessible avec session (retourne notConnected:true — attendu)
  - Tous les env vars sont correctement configurés
  - Tous les headers de sécurité présents

- ÉCHEC RESTANT (1 critique, 1 mineur) :
  - LinkedIn OAuth redirige vers "Client ID introuvable"
  - CAUSE : le flow LinkedIn est USER-CONFIGURED (pas env-var-based)
    L'utilisateur doit saisir son propre Client ID LinkedIn dans l'UI
  - CE N'EST PAS UN BUG — c'est le comportement attendu
  - Le test curl n'envoie pas de client_id, donc le serveur redirige vers l'erreur

- Audit code identifié :
  1. ⚠️ clientSecret stocké en localStorage non chiffré (appStore.ts persist)
  2. ⚠️ clientSecret transite par cookie httpOnly 10 min (acceptable pour OAuth)
  3. ⚠️ Demo password hardcoded (acceptable pour démo)
  4. ✅ Pas de leak du GitHub token dans le code
  5. À vérifier : validation du state CSRF sur le callback LinkedIn

Stage Summary:
- R-011 deep v7 audit COMPLÉTÉ — 17/19 tests passent
- Le login HERMÈS marche enfin après 7 itérations de fix
- L'utilisateur peut maintenant se connecter avec demo@hermes.app / Demo-Hermes-2024
- Pour connecter LinkedIn, l'utilisateur doit :
  1. Créer une app sur https://www.linkedin.com/developers/apps
  2. Configurer redirect URL = https://linkedin-visual-studio.onrender.com/api/linkedin/callback
  3. Dans HERMÈS → onglet LinkedIn → saisir Client ID + Secret
  4. Cliquer "Connecter LinkedIn"
- Rapport complet : /home/z/my-project/download/audit-e2e-2026-06-30.md

---
Task ID: R-012
Agent: main
Task: User requested no emojis in AI-generated posts and comments.

Work Log:
- Audited all AI text-generation entry points across src/lib/ (linkedin-ai.ts, agent-runner.ts, ai-client.ts, carousel-generator.ts) and src/scripts/gen_post.ts. Found 3 layers of emoji leakage: prompts that encouraged emojis ("Ajouter des émojis pertinents"), missing "Pas d'émoji" rules in 6 prompts, and 4 hardcoded emojis in carousel SVG defaults (📌 POST, 💬 Commentez, 🔔 Suivez-moi, 📌 CARROUSEL).
- Created src/lib/sanitize-text.ts with stripEmojis() and stripEmojisFromFields(). Regex covers \p{Extended_Pictographic}, regional-indicator pairs (flags), skin-tone modifiers (U+1F3FB–U+1F3FF), ZWJ (U+200D), and variation selectors (U+FE0F/U+FE0E). Preserves math symbols (× ÷ ± ≤ ≥ √ ∑ ∫ π), arrows (→ ←), and accented Latin chars. Collapses resulting whitespace but preserves newlines.
- Wrote 28 unit tests in src/lib/__tests__/sanitize-text.test.ts covering: single emoji, multiple emojis, ZWJ sequences (👨‍👩‍👧), skin-tone (👍🏽), flag pairs (🇫🇷), preservation of math/arrows/accents, newline preservation, whitespace collapse, edge cases (null, undefined, empty, whitespace-only), realistic LinkedIn post fixtures.
- Updated linkedin-ai.ts: added "AUCUN émoji" rule to generatePostSuggestions, generateFallbackSuggestions, generateCommentSuggestions, improvePost, generateExpertPosts, generateCarouselContent prompts. Replaced "Ajouter des émojis pertinents (avec parcimonie)" in improvePost with "AUCUN émoji". Applied stripEmojis() to all text fields returned from AI: post.text/topic/hook, comment.text, trending.topic/angle/suggestedHook, bestTime.reason, analysis.styleProfile/topTopics/etc, carousel.headline/body/accent/bullets/stat. Replaced hardcoded 📌 and 💬 emojis in fallback carousel with plain text.
- Updated agent-runner.ts (already had "Pas d'émoji" in 4 prompts): applied stripEmojis() to post.text + publishToLinkedIn call (runContenuAgent), message.content (runProspectionAgent), comment.comment (runEngagementAgent), action.content (runNurturingAgent), note (runReseauAgent). Also added stripEmojis() to Veille briefing (title/summary/trends/opportunities/competitors) and Analyse insights (metric/value/recommendation).
- Updated ai-client.ts: applied stripEmojis() to generateLinkedInPost() return value + added "AUCUN émoji" rule to its system prompt.
- Updated carousel-generator.ts: replaced "📌 POST" default with "POST", "💬 Commentez ci-dessous" with "Commentez ci-dessous", "🔔 Suivez-moi pour plus de contenu Data & IA" with "Suivez-moi pour plus de contenu Data & IA". Updated comment on accent field to reflect no-emoji policy.
- Updated scripts/gen_post.ts: removed contradictory "Pas d'émojis excessifs (2-3 max)" line, replaced with "Aucun émoji (politique R-012)".
- Updated src/app/api/linkedin/post/route.ts and src/app/api/linkedin/comment/route.ts: applied stripEmojis() to incoming text as last line of defense before forwarding to LinkedIn's v2 API. This catches emojis in hand-typed content too.

Stage Summary:
- Commit: 7c63199 (pushed to origin/main)
- Files changed: 9 (2 new, 7 modified)
- 443 insertions, 53 deletions
- All 252 tests pass (28 new for sanitizer)
- TypeScript clean, Next.js build clean
- Three-layer enforcement: prompt-level (instruction), sanitizer-level (output processing), API-level (last line of defense)
- Policy applies to: LinkedIn posts, LinkedIn comments, LinkedIn DMs (prospection/nurturing), connection notes, carousel slides, market briefings, performance insights
- Even if the AI model disobeys the prompt, the sanitizer guarantees zero emojis in stored or published content

---

Task ID: R-011-deep-v7-workflow-json-fix
Agent: main (Claude)
Task: Fix production crash `TypeError: e.nodes.map is not a function` and `429 Too Many Requests` on /api/auth/_log and /api/auth/session.

Work Log:
- Searched codebase for `.nodes.map(` calls — found 3 sites in WorkflowView.tsx and 1 in workflow-engine.ts
- Inspected `prismaToWorkflow()` and `prismaToExecution()` in src/lib/workflow/workflow-engine.ts
- Identified root cause: both functions used TypeScript `as` casts on Prisma String columns (e.g. `(row.nodes as WorkflowNode[]) ?? []`). The cast does NOT parse JSON at runtime — the API returned JSON-encoded strings, not arrays, so the client crashed on `.map()`.
- Same bug in `updateWorkflow()`: it wrote arrays directly to Prisma String columns (would have thrown a Prisma type mismatch on every PUT).
- Inspected src/lib/rate-limit.ts: the `auth` category was set to 10 req/min. NextAuth's client polls /api/auth/session every ~60s per tab and POSTs every client-side error to /api/auth/_log. When the nodes.map crash fired on every render, the NextAuth client spammed error logs, blew the 10/min budget, and blocked ALL /api/auth/* calls (session refresh, login) with 429.

Stage Summary:
- src/lib/workflow/workflow-engine.ts:
  - prismaToWorkflow: use parseJsonField() for nodes/edges/tags
  - prismaToExecution: use parseJsonField() for data/steps
  - updateWorkflow: use stringifyJsonField() before writing
- src/components/app/WorkflowView.tsx:
  - Added normalizeWorkflow() defense-in-depth helper that guarantees array-typed fields even if a future regression sends strings
  - All setSelectedWorkflow(data.workflow) call sites now wrap with normalizeWorkflow()
- src/lib/rate-limit.ts:
  - Raised `auth` limit from 10/min to 60/min (NextAuth needs headroom for session polling + error logging)
- Verification: `npx tsc --noEmit` passes clean; `npx vitest run` — all 252 tests across 12 suites pass
- Commit: f46eb70 `fix(workflows): parse JSON fields + raise auth rate limit`
- NOT YET DEPLOYED on Render — user needs to Manual Deploy to take effect

---
Task ID: phase-1.5-cron
Agent: Main Agent (Claude)
Task: Phase 1.5/1.6/1.7 — Cron infrastructure, LinkedIn metrics sync, LinkedIn token refresh

Work Log:
- Récupéré le repo distant (b56bdb3) qui contient déjà R-012 (no emojis in AI content) — la demande précédente de l'utilisateur est donc déjà satisfaite.
- Cherry-pické le commit Phase 1 (6feb1bd) par-dessus le remote. 6 conflits résolus (imports, syntaxe trailing comma, /api/email/track ajouté au middleware, etc.).
- Régénéré le client Prisma (le schema.prisma source dit String pour nodes/edges/tags mais le client généré avait Json? — mismatch corrigé).
- Corrigé 4 erreurs TypeScript restantes après cherry-pick:
  - compliance/linkedin-compliance.ts: ajouté initializedForUserId(userId) — pattern singleton multi-tenant safe
  - compliance-guard.ts: utilisé initializedForUserId au lieu de l'ancienne API (userId, action) à 2 args qui n'existe plus
  - workflow-engine.ts: ajouté param userId à executeWorkflow() (manquait — executeGraph/executeNode/executeAction l'avaient déjà)
  - workflow-engine.ts: remplacé fromJson/toJson/JsonValue (helpers supprimés du remote) par parseJsonField/stringifyJsonField pour Contact.tags
- Phase 1.5 — Cron infrastructure:
  - Créé src/lib/cron/auth.ts avec verifyCronSecret() (constant-time comparison, fail-closed si CRON_SECRET unset)
  - Créé /api/cron/agents (POST + GET) — publishAllDuePosts() toutes les 5 min
  - Créé /api/cron/metrics-sync — syncAllUsersMetrics() toutes les heures
  - Créé /api/cron/token-refresh — refreshAllExpiringTokens() daily 3am UTC
  - Ajouté /api/cron/ au middleware AUTH_SKIP_ROUTES
- Phase 1.6 — LinkedIn metrics sync:
  - Créé src/lib/linkedin/metrics-sync.ts avec syncUserLinkedInMetrics + recomputeUserMetrics + syncAllUsersMetrics
  - Ajouté champs linkedinUrn + metricsSyncedAt + index(userId, createdAt) à LinkedInPost
  - Créé migration 20260702000000_add_linkedin_post_urn
  - Modifié /api/linkedin/post pour persister linkedinUrn après publication
  - Sync: fetch /v2/socialActions/{urn}/likes + /comments, update LinkedInPost, recompute aggregate Metrics.tauxEngagement
- Phase 1.7 — LinkedIn token refresh:
  - Créé src/lib/linkedin/token-refresh.ts avec refreshLinkedInToken + refreshAllExpiringTokens
  - Window de refresh: 7 jours avant expiration
  - Appel POST /oauth/v2/accessToken avec grant_type=refresh_token
  - Déchiffre le token existant, l'utilise comme refresh_token, re-chiffre le nouveau token
- Phase 1.5 — Scheduled posts cron:
  - Extrait publishDuePosts() dans src/lib/linkedin/scheduled-posts.ts (était inline dans /api/linkedin/schedule)
  - Marque status='publishing' avant l'appel LinkedIn pour éviter double-publish en cas de cron concurrent
  - Persiste linkedinUrn + LinkedInPost row après publication réussie (pour que metrics sync puisse tracker)

Stage Summary:
- 13 fichiers changés, ~1000 lignes ajoutées
- 3 nouvelles routes cron: /api/cron/agents, /api/cron/metrics-sync, /api/cron/token-refresh
- 4 nouvelles libs: cron/auth, linkedin/metrics-sync, linkedin/token-refresh, linkedin/scheduled-posts
- 1 migration: add_linkedin_post_urn (linkedinUrn + metricsSyncedAt + index)
- tsc --noEmit: 0 erreur
- vitest run: 252 tests passent (12 suites)
- 3 commits poussés sur GitHub: 852289b (TS fixes post-cherry-pick), 3075163 (cron infra)
- PAS ENCORE DÉPLOYÉ sur Render — l'utilisateur doit:
  1. Configurer les 3 Render Cron Jobs (voir ci-dessous)
  2. Ajouter les env vars: CRON_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
  3. Déclencher un Manual Deploy sur Render

Render Cron Jobs config (dashboard → Cron Jobs):
- agents:        Schedule "*/5 * * * *"   Command: curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/agents
- metrics-sync:  Schedule "0 * * * *"     Command: curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/metrics-sync
- token-refresh: Schedule "0 3 * * *"     Command: curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/token-refresh


---
Task ID: phase-2-premium-ux
Agent: Main Agent (Claude)
Task: Phase 2 — Premium UX. Top 5 audit gaps: toasts, kill simulation framing, security fix, command palette, notification bell.

Work Log:
- Audit complet UI/UX via subagent Explore — identifié 10 domaines, top 5 priorisé par impact/effort.
- #1 Toasts (Sonner):
  - layout.tsx: remplacé Radix <Toaster> par Sonner <Toaster> (themed dark, top-right, richColors, closeButton).
  - src/lib/toast.ts: wrapper expose success/error/info/warning/loading/promise.
  - src/lib/api-fetch.ts: wrapper fetch() qui auto-fire toasts sur success/error/loading (réutilisable pour les 58 fetch calls).
  - Câblé toast.success/error dans 5 vues majeures: LinkedInView (publish, schedule, cancel), CRMView (contact + deal CRUD, advance), EmailView (send), AnalyticsView (create experiment), IntegrationsView (webhook create/delete/test).
- #2 Security fix — demo creds:
  - UserMenu.tsx LoginModal: était pré-rempli avec demo@hermes.app + auto-fill password + affichait les creds sur le form. Tout supprimé. Le compte démo existe toujours (seeded par auth-config.ts) mais n'est plus visible publiquement.
- #3 Kill 'simulation' framing:
  - DashboardView.tsx: remplacé la barre 'Lancer la simulation / Pause / x1·x2·x4' par une System Status Bar read-only (Système actif/en veille, agent count, dernière activité relative time, bouton 'Exécuter maintenant').
  - Nouveau hook src/hooks/use-system-status.ts: poll /api/data/orchestrator + /api/data/activity-logs + /api/data/metrics toutes les 30s. Fallback sur le store si l'orchestrator n'est pas initialisé.
  - Supprimé les trends fake hardcoded ('+2', '+0.4%', '+8', '+3') des metric cards — remplacé par badge 'live' neutre.
  - Empty state du activity feed: 'Lancez la simulation' → 'Vos agents s'activent automatiquement'.
  - Ajouté bouton 'Actualiser' pour refetch manuel.
- #4 Command Palette (Cmd+K):
  - Nouveau src/components/app/CommandPalette.tsx — palette fuzzy-search listant les 23 navItems groupés par section.
  - cmdk + Dialog primitives déjà existaient mais n'étaient pas utilisés — câblés.
  - Shortcut global Cmd+K / Ctrl+K enregistré sur window.
  - Trigger discoverable ajouté en haut du Sidebar avec badge '⌘K'.
- #5 Notification Bell:
  - Nouveau src/components/app/NotificationBell.tsx — icône cloche avec badge rouge unread count, dropdown preview 5 plus récents, 'Tout marquer lu', 'Voir toutes les notifications'.
  - Poll /api/data/notifications?unreadOnly=true toutes les 60s.
  - Monté dans le footer du Sidebar à côté de UserMenu (était accessible uniquement en naviguant à la vue Notifications).

Stage Summary:
- 15 fichiers changés, ~1100 lignes ajoutées
- 5 nouveaux fichiers: CommandPalette, NotificationBell, use-system-status, api-fetch, toast
- 10 fichiers modifiés: layout, page, Sidebar, UserMenu, DashboardView, LinkedInView, CRMView, EmailView, AnalyticsView, IntegrationsView
- tsc --noEmit: 0 erreur
- vitest run: 252 tests passent (12 suites)
- Commit: 59be923 poussé sur GitHub
- PAS ENCORE DÉPLOYÉ sur Render

