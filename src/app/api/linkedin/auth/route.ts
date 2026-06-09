import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateState,
  setStateCookie,
} from "@/lib/linkedin-token";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";

// Use OpenID Connect scopes (LinkedIn's current standard)
// Old scopes (r_liteprofile, r_emailaddress) are deprecated
const SCOPES = ["openid", "profile", "email", "w_member_social"];

/**
 * Validates a LinkedIn Client ID.
 * Returns an error message if invalid, null if valid.
 */
function validateClientId(clientId: string): string | null {
  if (!clientId) {
    return "Client ID manquant. Configurez-le dans les Paramètres.";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(clientId)) {
    return "Le Client ID LinkedIn n'est pas une adresse email. C'est un identifiant alphanumérique (ex: 78abcdefghijk) obtenu depuis le LinkedIn Developer Portal.";
  }
  if (clientId.length < 3) {
    return "Le Client ID LinkedIn semble trop court. Vérifiez la valeur dans les Paramètres.";
  }
  return null;
}

/**
 * POST /api/linkedin/auth
 * Step 1: Securely stores LinkedIn credentials in httpOnly cookies via POST body.
 * The client_secret is NEVER exposed in the URL — it's sent in the request body
 * and stored in a short-lived httpOnly cookie for the callback.
 *
 * The client_id can be passed in the URL since it's a public identifier,
 * but we store it in a cookie too for consistency.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret } = body;

    const validationError = validateClientId(clientId);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Store credentials in short-lived httpOnly cookies
    const response = NextResponse.json({ success: true }, { status: 200 });

    response.headers.append(
      "Set-Cookie",
      `li_client_id=${clientId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
    );

    if (clientSecret) {
      response.headers.append(
        "Set-Cookie",
        `li_client_secret=${clientSecret}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
      );
    }

    // Store redirect_uri from frontend if provided
    const { redirectUri } = body;
    if (redirectUri) {
      response.headers.append(
        "Set-Cookie",
        `li_redirect_uri=${encodeURIComponent(redirectUri)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
      );
    }

    return response;
  } catch (error) {
    console.error("LinkedIn prepare-auth error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la préparation de l'authentification LinkedIn" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/linkedin/auth?origin=...&client_id=...
 * Step 2: Redirects to LinkedIn OAuth authorization page.
 *
 * The client_id is a PUBLIC identifier and can safely be in the URL.
 * The client_secret is read from the httpOnly cookie (set by POST step) —
 * it is NEVER exposed in the URL.
 *
 * Flow:
 * 1. Frontend POSTs credentials to this endpoint (body, not URL)
 * 2. Frontend redirects browser to this endpoint with only origin + client_id in URL
 * 3. Server reads client_secret from cookie, redirects to LinkedIn
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin") || request.headers.get("origin") || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // client_id can come from URL (it's public) or from cookie (set by POST)
    const clientIdFromUrl = searchParams.get("client_id");
    const cookieStore = await cookies();
    const clientIdFromCookie = cookieStore.get("li_client_id")?.value;

    const clientId = clientIdFromUrl || clientIdFromCookie;

    if (!clientId) {
      return NextResponse.redirect(
        new URL("/?linkedin=error&message=Client+ID+introuvable.+R%C3%A9essayez+la+connexion.", request.url)
      );
    }

    // Validate Client ID
    const validationError = validateClientId(clientId);
    if (validationError) {
      return NextResponse.redirect(
        new URL(`/?linkedin=error&message=${encodeURIComponent(validationError)}`, request.url)
      );
    }

    // Compute the redirect URI — prefer the user-configured one from cookie
    const configuredRedirectUri = cookieStore.get("li_redirect_uri")?.value;
    const defaultRedirectUri = `${origin}/api/linkedin/callback`;
    const redirectUri = configuredRedirectUri || defaultRedirectUri;

    const state = generateState();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state: state,
    });

    const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;

    const response = NextResponse.redirect(authUrl);
    setStateCookie(response, state);

    // Store the redirect_uri used so callback can use the exact same one
    response.headers.append(
      "Set-Cookie",
      `li_redirect_uri_used=${encodeURIComponent(redirectUri)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
    );

    // Ensure client_id cookie is set for the callback (in case it came from URL)
    if (!clientIdFromCookie) {
      response.headers.append(
        "Set-Cookie",
        `li_client_id=${clientId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
      );
    }

    return response;
  } catch (error) {
    console.error("LinkedIn auth error:", error);
    return NextResponse.redirect(
      new URL("/?linkedin=error&message=Erreur+interne+lors+de+l'authentification.", request.url)
    );
  }
}
