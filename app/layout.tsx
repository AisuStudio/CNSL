import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted fonts via next/font so paths stay correct under a GitHub Pages
// basePath (and get hashed/optimized). Exposed as CSS variables.
const publicSans = localFont({
  src: [
    { path: "../public/fonts/public-sans/PublicSans-Light.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/public-sans/PublicSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/public-sans/PublicSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/public-sans/PublicSans-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/public-sans/PublicSans-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-public-sans",
  display: "swap",
});

const iaMono = localFont({
  src: [
    { path: "../public/fonts/ia-writer-mono/ia-writer-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/ia-writer-mono/ia-writer-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ia-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CNSL",
  description: "CNSL — task management",
  // Beta: keep the whole site out of search engines (crawl + index).
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CNSL",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#161519",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${publicSans.variable} ${iaMono.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla adds
          cz-shortcut-listen) inject attributes onto <body> before React
          hydrates. This only ignores attribute mismatches on <body>. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
