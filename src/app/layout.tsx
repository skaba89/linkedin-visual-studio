import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-provider";
import { HydrationGate } from "@/components/app/HydrationGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HERMÈS — Dashboard d'acquisition LinkedIn automatisée",
  description:
    "Gérez vos 3 agents IA (Contenu, Qualification, Prospection) pour automatiser 100% de votre acquisition LinkedIn.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // R-010 — Lecture du nonce CSP posé par le middleware
  // Le nonce est ensuite injecté dans <Script nonce={...}> pour autoriser
  // les scripts inline Next.js (analytics, hot-reload, etc.) tout en
  // maintenant une CSP stricte 'strict-dynamic'.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#080C10] text-white`}
      >
        <AuthProvider>
          <HydrationGate>
            {children}
          </HydrationGate>
          <SonnerToaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              classNames: {
                toast: "bg-[#0F1520] border-white/[0.08] text-[#F0F4F8]",
                title: "text-[#F0F4F8] font-medium",
                description: "text-[#7B8A9A]",
              },
            }}
          />
        </AuthProvider>
        {/* Le nonce est exposé aux composants client via cet attribut
            pour qu'ils puissent le passer aux <Script> tags si besoin. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.__HERMES_NONCE__=${JSON.stringify(nonce)};`,
          }}
        />
      </body>
    </html>
  );
}
