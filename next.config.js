/** @type {import('next').NextConfig} */

// Sent with every page and API reply: HTTPS only, no showing the site inside other sites (a
// trick used to fool people into clicking), no guessing file types, and only the camera is
// allowed (the scanner needs it).
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}
module.exports = nextConfig
