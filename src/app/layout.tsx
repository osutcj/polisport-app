import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PoliSport Tournament",
    template: "%s | PoliSport Tournament",
  },
  description:
    "Platforma oficială de management al turneului de fotbal PoliSport. Urmărește clasamentele, meciurile și statisticile jucătorilor.",
  keywords: ["turneu fotbal", "polisport", "clasament", "meciuri", "statistici"],
  authors: [{ name: "PoliSport" }],
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "PoliSport Tournament",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={inter.variable}>
      <body className="antialiased flex flex-col min-h-screen bg-green-50" suppressHydrationWarning>
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
