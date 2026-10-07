import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Die Komponenten sind .js-Dateien mit JSX (Next.js/SWC verdaut das ohne
// Konfiguration). Vitest nutzt esbuild und braucht dafür das React-Plugin.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{js,jsx}"],
    setupFiles: ["./vitest.setup.js"],
  },
});
