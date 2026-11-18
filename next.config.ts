import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy — which origins the browser may load anything
 * from. Scripts and styles keep 'unsafe-inline' because Next's bootstrap
 * script and React's style attributes are inline; everything else is pinned
 * to this origin plus Shopify's image CDN. The strict, nonce-based version is
 * the next step. No `upgrade-insecure-requests`: the shop is tested over
 * plain http on the LAN.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.shopify.com",
  "font-src 'self'",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  // Browsers only honour HSTS over https, so it's inert on the LAN.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // The "N" badge Next draws bottom-left in dev. Testing on a phone, it reads
  // as part of the shop. Build and runtime errors still show without it.
  devIndicators: false,
  // moodboard/ has its own lockfile; pin the root so Turbopack stops guessing.
  turbopack: { root: __dirname },
  // Next blocks cross-origin requests to dev-only assets by default, so a
  // tunnel (ngrok, Cloudflare, LocalTunnel) gets HTML but no JS chunks — the
  // page renders, never hydrates, and sits on the preloader forever.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
    // Phone on the same Wi-Fi, hitting http://<mac-ip>:3093. 172.x is the
    // range an iPhone hotspot hands out when the Mac rides the phone's data.
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
  // The share image reads its font from disk. On a host that runs server
  // code away from the project folder (Netlify), the file has to travel
  // with that route's bundle. Photos don't: they're fetched (opengraph-image.tsx).
  outputFileTracingIncludes: {
    "/product/*": ["./src/assets/NeueHaasDisplay-Medium.ttf"],
    "/*": ["./src/assets/NeueHaasDisplay-Medium.ttf"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // Photos only — two segments, /product/<handle>/<file>. The old
      // `/product/:path*` also matched the product PAGES and told browsers
      // to keep their HTML for a day, so a price or photo change didn't show
      // for returning visitors. Every photo URL carries ?v=<file time>
      // (mock.ts), so the file itself can be cached for a year.
      {
        source: "/product/:handle/:file",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
