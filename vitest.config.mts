/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 10000,
  },
});
