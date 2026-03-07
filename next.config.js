/** @type {import('next').NextConfig} */
const version = require("./version.json");
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_APP_VERSION: version.version,
    NEXT_PUBLIC_BUILD_UPDATES: JSON.stringify(version.updates || []),
  },
};

module.exports = nextConfig;
