/** @type {import('next').NextConfig} */

// Cabecalhos de seguranca das paginas (a API ja recebe os dela via Helmet).
// CSP fica para uma proxima etapa: o Next usa scripts inline e exige nonce.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
  output: 'standalone',
  // Nao anuncia "x-powered-by: Next.js" nas respostas.
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
}

module.exports = nextConfig
