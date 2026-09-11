/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ecom/*"],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
