/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Brand logo is hosted on the Berkshire Hathaway media CDN.
      { protocol: "https", hostname: "content.mediastg.net" },
    ],
  },
};

export default nextConfig;
