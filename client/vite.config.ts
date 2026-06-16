import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/communication": "http://localhost:3000",
      "/races": "http://localhost:3000",
      "/works": "http://localhost:3000",
      "/projections": "http://localhost:3000",
      "/reports": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
