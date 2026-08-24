import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadDesk",
    short_name: "LeadDesk",
    description: "Follow up with every lead, on the shop floor.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6f8",
    theme_color: "#16181d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
