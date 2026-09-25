import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Adaptive English", short_name: "Adaptive English",
    description: "English practice that adapts to you.", lang: "en",
    start_url: "/home", scope: "/", display: "standalone",
    background_color: "#f4f6f2", theme_color: "#245d46",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
