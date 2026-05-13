/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend API URL — set in Vercel env vars for prod
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig
