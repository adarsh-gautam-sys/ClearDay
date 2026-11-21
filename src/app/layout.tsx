import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClearDay — Urban Air Quality & Winter Smog Assistant",
  description:
    "GenAI-powered assistant helping families and communities navigate severe winter smog with low-emission daily routines, indoor air hacks, and transparent impact math.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased selection:bg-[#0F6E6E]/15 selection:text-[#18181B]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#FCFBF8] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#18181B] focus:shadow-beautiful-md"
        >
          Skip to main workspace
        </a>
        {children}
      </body>
    </html>
  );
}
