/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow reading files from parent directory (logs)
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

export default nextConfig;
