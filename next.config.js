/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Bust build cache
  generateBuildId: () => 'build-' + Date.now(),
};

module.exports = nextConfig;
