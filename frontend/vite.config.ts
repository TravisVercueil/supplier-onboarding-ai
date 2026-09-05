import { defineConfig } from "vite";
export default defineConfig({
  server: { proxy: { "/api": "http://127.0.0.1:8102" } },
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
