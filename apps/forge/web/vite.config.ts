import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const webRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: webRoot,
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes("node_modules") ? "vendor" : undefined;
        }
      }
    }
  }
});
