import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({test:{environment:"jsdom",setupFiles:["./src/test/setup.js"]},resolve:{alias:{"@":path.resolve("src")}}});
