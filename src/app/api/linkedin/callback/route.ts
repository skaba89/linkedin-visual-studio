import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getStateFromCookies,
  setTokenCookie,
  clearStateCookie,
} from "@/lib/linkedin-token";

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

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
        new URL(`/?linkedin=error&message=${encodeURIComponent(errorDesc)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?linkedin=error&message=Code+ou+state+manquant", request.url)
      );
    }

    // Verify state for CSRF protection
    const storedState = await getStateFromCookies();
    if (state !== storedState) {
      return NextResponse.redirect(
        new URL("/?linkedin=error&message=State+invalide", request.url)
      );
    }

    // Get client credentials from cookies
    const cookieStore = await cookies();
    const clientId = cookieStore.get("li_client_id")?.value;
    const clientSecret = cookieStore.get("li_client_secret")?.value;

    if (!clientId) {
      return NextResponse.redirect(
        new URL("/?linkedin=error&message=Client+ID+manquant", request.url)
      );
    }

    const origin = request.headers.get("origin") || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const redirectUri = `${origin}/api/linkedin/callback`;

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
        new URL(`/=?linkedin=error&message=${encodeURIComponent("Échec de l'échange de token")}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/?linkedin=error&message=Token+d'accès+non+reçu", request.url)
      );
    }

    // Redirect to the app with success
    const response = NextResponse.redirect(
      new URL("/?linkedin=connected", request.url)
    );

    // Store the access token in an httpOnly cookie
    setTokenCookie(response, accessToken);

    // Clean up OAuth state and client credential cookies
    clearStateCookie(response);
    response.headers.append("Set-Cookie", "li_client_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    response.headers.append("Set-Cookie", "li_client_secret=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");

    return response;
  } catch (error) {
    console.error("LinkedIn callback error:", error);
    return NextResponse.redirect(
      new URL("/?linkedin=error&message=Erreur+interne", request.url)
    );
  }
}
