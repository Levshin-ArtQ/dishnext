import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8772,
    host: true
  },
  preview: {
    port: 8772,
    host: true
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
