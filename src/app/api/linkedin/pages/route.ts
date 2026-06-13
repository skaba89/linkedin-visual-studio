import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    // Try to fetch organization pages from LinkedIn API
    // This endpoint lists organizations where the user is an ADMINISTRATOR
    try {
      const pagesResponse = await fetch(
        "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName,logoV2(original~:playableStreams))))",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        const elements = pagesData.elements || [];

        const pages = elements
          .map((el: Record<string, unknown>) => {
            const target = el.organizationalTarget as Record<string, unknown> | undefined;
            if (!target) return null;

            const id = String(target.id || "").replace("urn:li:organization:", "");
            const name = String(target.localizedName || "");
            const vanityName = target.vanityName
              ? `https://linkedin.com/company/${target.vanityName}`
              : "";
            const logo = (target.logoV2 as Record<string, unknown>)?.["original~"]
              ? ((target.logoV2 as Record<string, unknown>)["original~"] as Record<string, unknown>)?.["elements"]?.[0]?.["identifiers"]?.[0]?.["identifier"]
              : null;

            return {
              id,
              name,
              url: vanityName,
              pictureUrl: logo ? String(logo) : null,
            };
          })
          .filter(Boolean);

        return NextResponse.json({ pages });
      }
    } catch (fetchError) {
      console.error("LinkedIn pages fetch error:", fetchError);
    }

    // Fallback: return simulated data for demo purposes
    return NextResponse.json({
      pages: [
        {
          id: "sim-page-1",
          name: "HERMÈS AI",
          url: "https://linkedin.com/company/hermes-ai",
          pictureUrl: null,
        },
      ],
      simulated: true,
      message:
        "L'API LinkedIn Pages nécessite un accès Marketing Developer Platform. Affichage du mode aperçu.",
    });
  } catch (error) {
    console.error("LinkedIn pages error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
