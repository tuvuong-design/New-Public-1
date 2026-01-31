import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + auth cookies to Next backend during dev
      "/api": {
        target: process.env.VITE_NEXT_BASE_URL || "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
