import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, "");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "app/generated"],
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});