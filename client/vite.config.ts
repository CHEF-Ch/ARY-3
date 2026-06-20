import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  target: "http://localhost:3000",
  changeOrigin: true,
  bypass(req: import("http").IncomingMessage) {
    const accept = req.headers.accept || "";
    if (typeof accept === "string" && accept.includes("text/html")) {
      return "/index.html";
    }
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": apiProxy,
      "/admin": apiProxy,
      "/communication": apiProxy,
      "/races": apiProxy,
      "/works": apiProxy,
      "/awards": apiProxy,
      "/evidences": apiProxy,
      "/judge-assignments": apiProxy,
      "/judging-records": apiProxy,
      "/projections": apiProxy,
      "/reports": apiProxy,
      "/health": apiProxy,
    },
  },
});
