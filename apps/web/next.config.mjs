/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const configuredBackend = process.env.FLASK_API_URL?.replace(/\/+$/, "");
    if (process.env.VERCEL === "1" && !configuredBackend) {
      throw new Error("Set FLASK_API_URL in the Vercel project environment before deploying the web app.");
    }
    const backend = configuredBackend || "http://127.0.0.1:5000";
    return [{ source: "/api/:path*", destination: `${backend}/api/learnhub/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.bunnycdn.com" }
    ]
  }
};

export default nextConfig;
