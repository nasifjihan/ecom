/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ecom/*"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
