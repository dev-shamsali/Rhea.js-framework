import { defineConfig } from "vitest/config";
// Dependency security regression tests: generate real projects, install from the registry, run the real `npm audit`.
export default defineConfig({ test: { include: ["tests/e2e/security.test.ts"], testTimeout: 300_000, hookTimeout: 300_000, fileParallelism: false } });
