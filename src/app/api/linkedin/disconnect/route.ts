import { NextResponse } from "next/server";
import { clearTokenCookie } from "@/lib/linkedin-token";

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Déconnecté de LinkedIn avec succès",
    });

    clearTokenCookie(response);

    return response;
  } catch (error) {
    console.error("LinkedIn disconnect error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion" },
      { status: 500 }
    );
  }
}
