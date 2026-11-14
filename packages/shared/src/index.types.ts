// Declaration-only entry point (see tsconfig.build.json) - NodeNext consumers (apps/api) need
// explicit extensions to resolve these re-exports; runtime code never imports this file, only
// src/index.ts (package.json "main"), which stays extension-free for Metro/Vite/Node's native
// TS runtime.
export * from "./targets.js";
export * from "./schemas.js";
