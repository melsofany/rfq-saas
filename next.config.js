/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['whatsapp-api-js'],
  // Bust build cache
  generateBuildId: () => 'build-' + Date.now(),
};

module.exports = nextConfig;
