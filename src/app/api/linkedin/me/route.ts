import { NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

export async function GET() {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    // Fetch profile from LinkedIn API
    const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("LinkedIn profile fetch failed:", profileResponse.status, errorText);

      if (profileResponse.status === 401) {
        return NextResponse.json(
          { error: "Token expiré. Reconnectez votre compte LinkedIn.", tokenExpired: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Erreur lors de la récupération du profil LinkedIn" },
        { status: profileResponse.status }
      );
    }

    const profileData = await profileResponse.json();

    // Extract profile information
    const localizedName = profileData.localizedName || "";
    const firstName = profileData.localizedFirstName || localizedName.split(" ")[0] || "";
    const lastName = profileData.localizedLastName || localizedName.split(" ").slice(1).join(" ") || "";
    const linkedinId = profileData.id || "";

    // Try to get profile picture
    let profilePictureUrl: string | null = null;
    if (profileData.profilePicture?.displayImageContent?.elements) {
      const elements = profileData.profilePicture.displayImageContent.elements;
      // Get the largest image
      const imageElement = elements[element => element]?.[0];
      if (imageElement?.identifiers?.[0]?.identifier) {
        profilePictureUrl = imageElement.identifiers[0].identifier;
      }
    }

    // Try to fetch headline from profile
    let headline: string | null = null;
    if (profileData.headline) {
      headline = profileData.headline.localized?.fr_FR ||
                 profileData.headline.localized?.en_US ||
                 Object.values(profileData.headline.localized || {})[0] as string ||
                 null;
    }

    return NextResponse.json({
      id: linkedinId,
      firstName,
      lastName,
      profilePictureUrl,
      headline,
    });
  } catch (error) {
    console.error("LinkedIn me error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
