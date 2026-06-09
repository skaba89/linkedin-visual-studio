# Task: LinkedIn Integration for HERMÈS Dashboard

## Summary
Implemented a complete LinkedIn integration with OAuth 2.0 authentication, post creation, liking, commenting, and feed viewing in the HERMÈS Next.js 16 dashboard application.

## Files Created

### Backend API Routes
1. **`/src/lib/linkedin-token.ts`** — Token management helper
   - `getTokenFromCookies()` / `setTokenCookie()` — httpOnly cookie-based token storage
   - `setStateCookie()` / `getStateFromCookies()` / `clearStateCookie()` — OAuth state CSRF protection
   - `generateState()` — Random state string generation
   - `clearTokenCookie()` — Disconnect functionality

2. **`/src/app/api/linkedin/auth/route.ts`** — OAuth 2.0 initiation
   - Redirects to LinkedIn authorization URL
   - Scopes: r_liteprofile, r_emailaddress, w_member_social, r_member_social
   - Stores client_id/client_secret in short-lived cookies for callback

3. **`/src/app/api/linkedin/callback/route.ts`** — OAuth callback handler
   - Exchanges authorization code for access token
   - Validates state parameter for CSRF protection
   - Stores token in httpOnly cookie, redirects to `/?linkedin=connected`

4. **`/src/app/api/linkedin/me/route.ts`** — Profile fetching
   - GET: Fetches LinkedIn profile using stored access token
   - Returns: id, firstName, lastName, profilePictureUrl, headline

5. **`/src/app/api/linkedin/post/route.ts`** — Post creation
   - POST: Creates UGC posts on LinkedIn
   - Supports PUBLIC and CONNECTIONS visibility

6. **`/src/app/api/linkedin/like/route.ts`** — Like functionality
   - POST: Likes a post using socialActions API

7. **`/src/app/api/linkedin/comment/route.ts`** — Comment functionality
   - POST: Comments on a post using socialActions API

8. **`/src/app/api/linkedin/feed/route.ts`** — Feed fetching
   - GET: Tries LinkedIn API first, falls back to simulated French B2B feed
   - 6 realistic simulated posts about IA, B2B prospection, automation

9. **`/src/app/api/linkedin/disconnect/route.ts`** — Disconnect
   - POST: Clears token cookie

### Frontend Components
10. **`/src/components/app/LinkedInView.tsx`** — Main LinkedIn integration page (4 tabs)
    - **Connexion tab**: OAuth flow with config fields, connection steps, permissions display, profile card when connected
    - **Publier tab**: Post composer with character counter, visibility selector, preview, template loader
    - **Feed tab**: Feed viewer with like/comment interactions, simulated mode indicator
    - **Engager tab**: Keyword monitoring, bulk like/comment, auto-engage simulation, activity log

### Updated Files
11. **`/src/store/appStore.ts`** — Added LinkedIn state
    - ViewType now includes "linkedin"
    - LinkedInProfile and LinkedInPost interfaces
    - linkedInConnected, linkedInProfile, linkedInConfig, linkedInPosts state + setters

12. **`/src/components/app/Sidebar.tsx`** — Added LinkedIn nav item
    - "LinkedIn" item in "CANAUX" section with Linkedin icon
    - Green dot indicator when connected

13. **`/src/app/page.tsx`** — Added LinkedIn view routing
    - LinkedInView component import
    - `case "linkedin"` in renderView
    - OAuth callback handler for `?linkedin=connected` and `?linkedin=error` query params

14. **`/src/components/app/SettingsView.tsx`** — Added LinkedIn config section
    - Client ID, Client Secret (with show/hide), Redirect URI fields
    - "Tester la connexion" button
    - LinkedIn blue (#0A66C2) color theme

## Design Choices
- LinkedIn-specific elements use #0A66C2 (LinkedIn blue)
- Consistent dark theme matching the existing HERMÈS design
- Token stored in httpOnly secure cookies (not localStorage)
- Graceful fallback to simulation mode for feed
- All text in French to match the existing app locale
- Responsive design with mobile-first approach

## Testing
- ESLint passes with no errors
- All API routes compile and respond correctly
- Main page loads with 200 status
- API routes return proper 401 when not authenticated
- Disconnect endpoint returns success
