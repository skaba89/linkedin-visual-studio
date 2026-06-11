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
