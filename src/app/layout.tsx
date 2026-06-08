import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3 agents HERMÈS — 35 RDVs, acquisition LinkedIn 100% automatisée | A.R.C Système",
  description:
    "Sans assistant. Sans SDR. Sans passer vos journées en DM. Ce guide vous montre exactement comment paramétrer les 3 agents HERMÈS qui gèrent votre acquisition LinkedIn de bout en bout, 24h/7j.",
  keywords: ["HERMÈS", "LinkedIn", "acquisition", "agents IA", "automatisation", "prospection", "A.R.C Système"],
  authors: [{ name: "A.R.C Système" }],
  openGraph: {
    title: "3 agents HERMÈS — 35 RDVs, acquisition LinkedIn 100% automatisée",
    description: "Le système à 3 agents IA qui gère votre acquisition LinkedIn de bout en bout, 24h/7j.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#080C10] text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
