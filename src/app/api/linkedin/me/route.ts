import { NextResponse } from "next/server";
import { getTokenFromCookies, clearTokenCookie } from "@/lib/linkedin-token";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn.", notConnected: true },
        { status: 401 }
      );
    }

    // Try OpenID Connect userinfo endpoint first (current LinkedIn standard)
    let profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Fallback to v2/me if userinfo fails (older apps)
    if (!profileResponse.ok) {
      profileResponse = await fetch("https://api.linkedin.com/v2/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("LinkedIn profile fetch failed:", profileResponse.status, errorText);

      if (profileResponse.status === 401) {
        // Token expired or invalid — clear it and require reconnection
        const response = NextResponse.json(
          { error: "Token expiré ou invalide. Reconnectez votre compte LinkedIn.", tokenExpired: true },
          { status: 401 }
        );
        clearTokenCookie(response);
        return response;
      }

      return NextResponse.json(
        { error: `Erreur LinkedIn API (${profileResponse.status}). Vérifiez vos permissions.` },
        { status: profileResponse.status }
      );
    }

    const profileData = await profileResponse.json();

    // Handle OpenID Connect format (v2/userinfo)
    let firstName = "";
    let lastName = "";
    let linkedinId = "";
    let profilePictureUrl: string | null = null;
    let headline: string | null = null;

    if (profileData.sub) {
      // OpenID Connect response format
      linkedinId = profileData.sub || "";
      firstName = profileData.given_name || profileData.name?.split(" ")[0] || "";
      lastName = profileData.family_name || profileData.name?.split(" ").slice(1).join(" ") || "";
      profilePictureUrl = profileData.picture || null;
      headline = profileData.headline || null;
    } else {
      // Legacy v2/me response format
      const localizedName = profileData.localizedName || "";
      firstName = profileData.localizedFirstName || localizedName.split(" ")[0] || "";
      lastName = profileData.localizedLastName || localizedName.split(" ").slice(1).join(" ") || "";
      linkedinId = profileData.id || "";

      // Try to get profile picture (legacy format)
      if (profileData.profilePicture?.displayImageContent?.elements) {
        const elements = profileData.profilePicture.displayImageContent.elements;
        // Get the largest image (last element usually has the largest)
        const lastElement = elements[elements.length - 1];
        if (lastElement?.identifiers?.[0]?.identifier) {
          profilePictureUrl = lastElement.identifiers[0].identifier;
        }
      }

      // Try to fetch headline from profile (legacy format)
      if (profileData.headline) {
        headline = profileData.headline.localized?.fr_FR ||
                   profileData.headline.localized?.en_US ||
                   Object.values(profileData.headline.localized || {})[0] as string ||
                   null;
      }
    }

    // Try to fetch email address
    let email: string | null = null;
    try {
      const emailResponse = await fetch("https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        email = emailData.elements?.[0]?.["handle~"]?.emailAddress || null;
      }
    } catch {
      // Email fetch is optional
    }

    return NextResponse.json({
      id: linkedinId,
      firstName,
      lastName,
      profilePictureUrl,
      headline,
      email,
    });
  } catch (error) {
    console.error("LinkedIn me error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
