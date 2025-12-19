/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Handle Stellar SDK which uses Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },
  // Disable server-side rendering for pages that use browser APIs
  experimental: {
    serverComponentsExternalPackages: ['@stellar/stellar-sdk'],
  },
}

module.exports = nextConfig
