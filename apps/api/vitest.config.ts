import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// esbuild (Vitest's default transform) does not emit TypeScript's emitDecoratorMetadata, which
// NestJS constructor injection relies on - see CLAUDE.md "Known issue to carry forward". swc does.
export default defineConfig({
  test: {
    environment: "node",
  },
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
});
