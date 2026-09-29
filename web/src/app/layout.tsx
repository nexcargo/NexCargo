// NexCargo — Document Root Layout
// Single source of <html>, <body>, fonts, and global styles
// All other layouts ({[locale]}, route-groups, pages) are nested beneath this.

import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexCargo — AI-Native Logistics Marketplace",
  description: "AI-native logistics marketplace platform connecting cargo owners and transport providers across the SADC region",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  icons: {
    icon: [
      { url: '/assets/brand/favicon/favicon.ico', type: 'image/x-icon' },
      { url: '/assets/brand/favicon/icon.svg', type: 'image/svg+xml' },
      { url: '/assets/brand/favicon/icon.png', rel: 'icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/assets/brand/favicon/apple-icon.png',
  },
  other: {
    'manifest': '/assets/brand/favicon/manifest.json',
  },
  openGraph: {
    title: "NexCargo — AI-Native Logistics Marketplace",
    description: "AI-native logistics marketplace platform connecting cargo owners and transport providers across the SADC region.",
    type: "website",
    locale: "pt_PT",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/assets/brand/favicon/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
