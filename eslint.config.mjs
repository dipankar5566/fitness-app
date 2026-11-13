// Single root-level flat config for the whole monorepo (apps/*, packages/*, db).
// Deliberately not per-package: pnpm is strict about phantom dependencies, so keeping
// eslint itself as a single root devDependency avoids adding it to every workspace package.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "**/.turbo/**", "**/coverage/**", "**/*.sql"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
