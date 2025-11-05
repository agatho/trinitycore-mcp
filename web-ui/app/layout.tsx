import type { Metadata } from "next";
// Temporarily disabled Google Fonts due to TLS issues in build environment
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Using system fonts as fallback
const geistSans = {
  variable: "--font-geist-sans",
};

const geistMono = {
  variable: "--font-geist-mono",
};

export const metadata: Metadata = {
  title: "TrinityCore API Explorer - Enterprise MCP-Enhanced Documentation",
  description: "Complete TrinityCore API documentation with live database access, interactive playground, and real-time game data via MCP integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
