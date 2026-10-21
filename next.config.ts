import type { NextConfig } from "next";

// ponytail: headers de segurança (refactor-plan R5.3). O bloco é conservador
// de propósito: cada linha aqui é o que quebra ZERO funcionalidade — CSP com
// nonce (script-src sem unsafe-inline) exige infra de middleware e é trabalho
// de deploy; a lista abaixo é o piso que não tem desculpa para faltar.
//
// - HSTS: força HTTPS no navegador por 2 anos, com preload.
// - frame-ancestors/X-Frame-Options: o app não é embeddável — clickjacking
//   em leilão é dar lance dentro de um site que parece outra coisa.
// - nosniff: um upload malicioso não vira script pelo Content-Type.
// - Permissions-Policy: câmera/microfone/geolocalização não existem no app —
//   negar por padrão é grátis e honesto.
// - CSP: `img-src https:` porque as fotos vêm de CDN (uploadthing/MP) e o QR
//   é data URL; `style-src 'unsafe-inline'` é o preço do Tailwind/Next com
//   estilos inline sem a infraestrutura de nonce; `connect-src 'self'` porque
//   as chamadas externas (MP/OpenRouter/Gemini) são TODAS server-side — o CSP
//   rege o navegador, e o navegador só fala com a própria origem.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ponytail (R2.3): domínios de imagem que o next/image pode otimizar.
  // UploadThing (utfs.io) serve TODAS as fotos do app; o QR do MP é data URL
  // (otimização não se aplica — `<Image unoptimized>`).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.utfs.io" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
