// Version is read from package.json or version.json at build time.
// For runtime, we use env or a default; increment version in version.json as needed.
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

// Build time in ISO string; set in next.config.js env at build time.
export const BUILD_TIME =
  process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString();
