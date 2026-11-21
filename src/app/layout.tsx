import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearDay — Urban Air Quality Assistant",
  description:
    "GenAI-powered assistant helping families and communities navigate severe winter smog with low-emission routines and indoor air hacks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
