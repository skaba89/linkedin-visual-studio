import { NextRequest, NextResponse } from "next/server";
import {
  generateState,
  setStateCookie,
} from "@/lib/linkedin-token";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";

const SCOPES = ["r_liteprofile", "r_emailaddress", "w_member_social", "r_member_social"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin") || request.headers.get("origin") || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Read client ID from query params (sent from the frontend store)
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID manquant. Configurez-le dans les Paramètres." },
        { status: 400 }
      );
    }

    const redirectUri = `${origin}/api/linkedin/callback`;
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

    // Store client_id and client_secret in short-lived cookies for the callback
    response.headers.append(
      "Set-Cookie",
      `li_client_id=${clientId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );

    const clientSecret = searchParams.get("client_secret");
    if (clientSecret) {
      response.headers.append(
        "Set-Cookie",
        `li_client_secret=${clientSecret}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
      );
    }

    return response;
  } catch (error) {
    console.error("LinkedIn auth error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'initialisation de l'authentification LinkedIn" },
      { status: 500 }
    );
  }
}
