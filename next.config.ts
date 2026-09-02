import type { NextConfig } from "next";
import { getRpcConnectSources } from './lib/rpc'

const rpcConnectSources = getRpcConnectSources().join(' ')

export const securityHeaders = [
  { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${rpcConnectSources}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
] as const

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [...securityHeaders] }]
  },
};

export default nextConfig;
