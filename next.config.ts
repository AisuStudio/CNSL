import type { NextConfig } from "next";

// GitHub Pages build: static export under the repo subpath. Enabled only when
// GHPAGES=true (set by the deploy workflow) so `next dev` and other hosts are
// unaffected. PAGES_BASE_PATH is "/<repo>" (the workflow derives it).
const isPages = process.env.GHPAGES === "true";
const basePath = process.env.PAGES_BASE_PATH || "";

// ── Security headers (S1) ──────────────────────────────────────────────
// Applied on the real (Vercel) host. The static-export branch (GitHub Pages
// demo) can't emit response headers, so they're skipped there — harmless, the
// demo has no backend/secrets.
//
// CSP is shipped Report-Only first (it can't break anything; it only reports)
// so we can promote it to enforcing once we've confirmed no false positives.
// The app talks only to itself (/api) and Supabase (REST + Realtime websocket),
// so connect-src is scoped to those. script/style keep 'unsafe-inline' for now
// (the layout theme script + Next's inline runtime + Tailwind) — tightening to
// nonces is a follow-up. frame-ancestors/object-src/base-uri/form-action are
// already meaningful even with unsafe-inline.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // HTTPS only, for 2 years, incl. subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Belt-and-braces clickjacking protection (CSP frame-ancestors is the modern one).
  { key: "X-Frame-Options", value: "DENY" },
  // No MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath || undefined,
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;
