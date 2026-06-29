// HERMÈS — Vitest configuration (R-009)
// - Path alias @/ → src/ (mirrors tsconfig.json)
// - Node environment (we test crypto/Prisma mocks, not DOM)
// - Glob: src/lib/__tests__/{asterisk}{asterisk}/{asterisk}.test.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "node",
    include: ["src/lib/__tests__/**/*.test.ts"],
    globals: false,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/__tests__/**", "src/lib/**/*.test.ts"],
    },
  },
});
