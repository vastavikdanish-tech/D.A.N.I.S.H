import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D.A.N.I.S.H — Personal AI Operating System",
    short_name: "D.A.N.I.S.H",
    description: "Dynamic AI Network for Intelligence, Systems & Help",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#020509",
    theme_color: "#020509",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["productivity", "utilities", "artificial-intelligence"],
    orientation: "any",
    lang: "en",
  };
}
