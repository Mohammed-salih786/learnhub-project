/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.bunnycdn.com" }
    ]
  },

  // Suppress OpenTelemetry dynamic-require warnings from @sentry/node internals
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /require-in-the-middle/ },
        { module: /@opentelemetry\/instrumentation/ }
      ];
    }
    return config;
  }
};

export default nextConfig;
