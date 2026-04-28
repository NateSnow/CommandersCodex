/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  // Set base to repo name for GitHub Pages deployment.
  // Change this to "/" if deploying to a custom domain or root path.
  base: "/CommandersCodex/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
