import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
var stdin_default = defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true, generatedRouteTree: "./src/routeTree.gen.js", disableTypes: true }), react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") } },
  server: { port: 5173, proxy: { "/api": "http://localhost:3000", "/uploads": "http://localhost:3000" } }
});
export {
  stdin_default as default
};
