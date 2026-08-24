import type { MetadataRoute } from "next";

/**
 * Makes the app installable to a phone home screen, which is how it is meant
 * to be used — "Add to Home Screen" gives it a standalone window with no
 * browser chrome eating the top of the screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bragging Rights",
    short_name: "Bragging Rights",
    description:
      "Log 1v1 FIFA results, track head-to-heads, settle the argument.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
