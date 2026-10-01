import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In der Entwicklung leitet Vite /api an die API weiter → gleiche Adresse, Cookies funktionieren.
    proxy: { "/api": "http://localhost:3000", "/health": "http://localhost:3000" },
  },
});
