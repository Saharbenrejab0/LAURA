/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Hide the floating "N" dev indicator (Next.js Devtools)
  // It's only visible in dev anyway, but cleaner during demos.
  devIndicators: false,

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
