import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getStateFromCookies,
  setTokenCookie,
  clearStateCookie,
  persistTokenToDB,
  fetchLinkedInProfile,
} from "@/lib/linkedin-token";
import { requireUser } from "@/lib/session";
import { createLogger } from "@/lib/logger";
import { appUrl, appUrlFor } from "@/lib/app-url";

const log = createLogger("linkedin-callback");
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

/**
 * HERMÈS — R-004 deep — LinkedIn OAuth callback
 *
 * After LinkedIn redirects back with `?code=...&state=...`:
 *  1. Verify state (CSRF) against the cookie set by /api/linkedin/auth
 *  2. Require an authenticated HERMÈS user (the token must be attached to
 *     a specific user — no global tokens)
 *  3. Exchange the authorization code for an access token with LinkedIn
 *  4. Fetch the LinkedIn profile via OpenID Connect /v2/userinfo
 *  5. Persist the encrypted token + profile to LinkedInAuth (DB)
 *  6. Also set the encrypted cookie for fast path access in the browser
 *  7. Clean up OAuth state and client credential cookies
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle user denial or LinkedIn errors
    if (error) {
      const errorDesc = searchParams.get("error_description") || error;
      return NextResponse.redirect(
        appUrlFor(request, `/?linkedin=error&message=${encodeURIComponent(errorDesc)}`)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        appUrlFor(request, "/?linkedin=error&message=Code+ou+state+manquant")
      );
    }

    // Verify state for CSRF protection
    const storedState = await getStateFromCookies();
    if (state !== storedState) {
      return NextResponse.redirect(
        appUrlFor(request, "/?linkedin=error&message=State+invalide")
      );
    }

    // Require an authenticated HERMÈS user — LinkedIn tokens are per-user
    let user;
    try {
      user = await requireUser();
    } catch (err) {
      // R-010 deep: log diagnostic info so we can debug the root cause.
      // The two usual causes are:
      //  (a) NEXTAUTH_URL env var missing on Render → appUrl() falls back to 0.0.0.0:10000
      //  (b) AUTH_TRUST_HOST not set → NextAuth can't read X-Forwarded-Host → session cookie mis-set
      log.warn("LinkedIn callback called without authenticated user", {
        error: err instanceof Error ? err.message : String(err),
        // Diagnostic: which URL resolver path is being taken?
        nextauthUrl: process.env.NEXTAUTH_URL ?? "(not set)",
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
        authTrustHost: process.env.AUTH_TRUST_HOST ?? "(not set)",
        nodeEnv: process.env.NODE_ENV,
        // What does the proxy tell us?
        forwardedHost: request.headers.get("x-forwarded-host") ?? "(not set)",
        forwardedProto: request.headers.get("x-forwarded-proto") ?? "(not set)",
        hostHeader: request.headers.get("host") ?? "(not set)",
        // What Next.js sees as the request URL (internal address on Render)
        nextUrlHost: request.nextUrl.host,
      });
      return NextResponse.redirect(
        appUrlFor(request, "/?linkedin=error&message=Connexion+requis+avant+de+lier+votre+compte+LinkedIn")
      );
    }

    // Get client credentials from cookies
    const cookieStore = await cookies();
    const clientId = cookieStore.get("li_client_id")?.value;
    const clientSecret = cookieStore.get("li_client_secret")?.value;

    if (!clientId) {
      return NextResponse.redirect(
        appUrlFor(request, "/?linkedin=error&message=Client+ID+manquant")
      );
    }

    // Use the exact same redirect_uri that was used in the auth request (stored in cookie)
    // IMPORTANT: use the public app URL, NOT request.nextUrl.host which resolves to
    // the internal bind address (0.0.0.0:10000) on Render.
    const storedRedirectUri = cookieStore.get("li_redirect_uri_used")?.value;
    const defaultRedirectUri = `${appUrl(request)}/api/linkedin/callback`;
    const redirectUri = storedRedirectUri ? decodeURIComponent(storedRedirectUri) : defaultRedirectUri;

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("LinkedIn token exchange failed:", errorData);
      return NextResponse.redirect(
        appUrlFor(request, `/?linkedin=error&message=${encodeURIComponent("Échec de l'échange de token")}`)
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        appUrlFor(request, "/?linkedin=error&message=Token+d'accès+non+reçu")
      );
    }

    // R-004 deep: fetch the LinkedIn profile + persist encrypted token to DB.
    // The profile fetch is best-effort — if it fails, we still persist the
    // token (without linkedInUserId, the schedule route will report the error).
    const profile = await fetchLinkedInProfile(accessToken);
    if (profile) {
      const tokenExpiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined;
      try {
        await persistTokenToDB(user.id, accessToken, {
          ...profile,
          tokenExpiresAt,
        });
      } catch (err) {
        // Log but don't fail — the cookie will still be set so the current
        // browser session works. The DB persistence can be retried later.
        log.error("Failed to persist LinkedIn token to DB", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Persist token without profile (linkedInUserId will be "")
      try {
        await persistTokenToDB(user.id, accessToken);
      } catch (err) {
        log.error("Failed to persist LinkedIn token to DB (no profile)", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Redirect to the app with success
    const response = NextResponse.redirect(
      appUrlFor(request, "/?linkedin=connected")
    );

    // Store the access token in an httpOnly cookie (encrypted)
    setTokenCookie(response, accessToken);

    // Clean up OAuth state and client credential cookies
    clearStateCookie(response);
    response.headers.append("Set-Cookie", "li_client_id=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    response.headers.append("Set-Cookie", "li_client_secret=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    response.headers.append("Set-Cookie", "li_redirect_uri=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    response.headers.append("Set-Cookie", "li_redirect_uri_used=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");

    return response;
  } catch (error) {
    console.error("LinkedIn callback error:", error);
    return NextResponse.redirect(
      appUrlFor(request, "/?linkedin=error&message=Erreur+interne")
    );
  }
}
