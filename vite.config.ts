import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// @ts-expect-error local Vite middleware, plain JS
import { catalogEditorPlugin } from "./scripts/vite-catalog-editor.js";

export default defineConfig({
  plugins: [react(), catalogEditorPlugin()],
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
