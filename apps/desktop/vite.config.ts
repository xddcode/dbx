import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const isTauri = !!host || !!process.env.TAURI_ENV_ARCH;

export default defineConfig(async () => ({
  root: __dirname,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            "codemirror",
            "@codemirror/lang-sql",
            "@codemirror/view",
            "@codemirror/state",
            "@codemirror/autocomplete",
            "@codemirror/commands",
            "@codemirror/theme-one-dark",
          ],
          "sql-formatter": ["sql-formatter"],
          ui: ["reka-ui"],
          marked: ["marked"],
        },
      },
    },
  },
  server: {
    port: isTauri ? 1420 : undefined,
    strictPort: isTauri,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    proxy: isTauri
      ? undefined
      : {
          "/api": {
            target: "http://localhost:4224",
            changeOrigin: true,
          },
        },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
