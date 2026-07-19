/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@final-third/shared"],
  reactStrictMode: true,
  webpack: (config) => {
    // Optional Privy peers — stub if missing; installed packages resolve normally.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@stripe/crypto": false,
      "@farcaster/mini-app-solana": false,
      "@farcaster/frame-sdk": false,
    };
    // Required by @privy-io/react-auth Solana support under webpack.
    config.externals = config.externals || {};
    if (typeof config.externals === "object" && !Array.isArray(config.externals)) {
      config.externals["@solana/kit"] = "commonjs @solana/kit";
      config.externals["@solana-program/memo"] = "commonjs @solana-program/memo";
      config.externals["@solana-program/system"] = "commonjs @solana-program/system";
      config.externals["@solana-program/token"] = "commonjs @solana-program/token";
    }
    return config;
  },
};

export default nextConfig;
