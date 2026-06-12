import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones/tablets on the LAN to load dev JS chunks — Next 16 blocks
  // cross-origin dev resources by default, which leaves pages rendered but
  // without any client-side interactivity on other devices.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.1.66",
    "192.168.2.111",
    "magnus-sin-macbook-air.local",
  ],
};

export default nextConfig;
