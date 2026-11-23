// Declaration-only entry point (see tsconfig.build.json) - NodeNext consumers (apps/api) need
// explicit extensions to resolve these re-exports; runtime code never imports this file, only
// src/index.ts (package.json "main"), which stays extension-free for Metro/Vite/Node's native
// TS runtime.
export * from "./targets.js";
export * from "./schemas.js";
export * from "./diet.js";
export * from "./workout-prs.js";
export * from "./programs.js";
export * from "./coach-safety.js";
export * from "./meal-summary.js";
export * from "./streak.js";
export * from "./food-relevance.js";
export * from "./fasting.js";
export * from "./achievements.js";
export * from "./meal-plan.js";
export * from "./progress.js";
