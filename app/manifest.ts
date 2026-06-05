import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D.A.N.I.S.H — Personal AI Operating System",
    short_name: "D.A.N.I.S.H",
    description: "Dynamic AI Network for Intelligence, Systems & Help",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#020509",
    theme_color: "#00e5ff",
    categories: ["productivity", "utilities", "artificial-intelligence"],
    orientation: "portrait",
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
      { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Chat",
        short_name: "Chat",
        description: "Open AI chat",
        url: "/dashboard?tab=chat",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Memory",
        short_name: "Memory",
        description: "View memories",
        url: "/dashboard?tab=memory",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Devices",
        short_name: "Devices",
        description: "Connected devices",
        url: "/dashboard?tab=devices",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Reminders",
        short_name: "Reminders",
        description: "View reminders",
        url: "/dashboard?tab=reminders",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };
}
