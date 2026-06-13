import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:3001",
      "/projects": "http://localhost:3001",
      "/requirements": "http://localhost:3001",
      "/task-drafts": "http://localhost:3001",
      "/workflow-files": "http://localhost:3001"
    }
  }
});
