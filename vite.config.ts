import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "web",
  base: "/",
  envDir: "..",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        overlay: resolve(import.meta.dirname, "web/overlay.html"),
        mod: resolve(import.meta.dirname, "web/mod.html"),
      },
    },
  },
});
