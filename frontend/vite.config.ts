import { defineConfig } from "vite";
export default defineConfig({
  server: {
    // Keep the browser Host so Django can enforce same-origin CSRF through Vite.
    proxy: { "/api": { target: "http://127.0.0.1:8102", changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // This app is entirely client-rendered. Fluent's RSC markers are redundant here.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"') &&
          /node_modules\/(?:@fluentui|@griffel)\//.test(warning.id ?? "")
        )
          return;
        warn(warning);
      },
    },
  },
});
