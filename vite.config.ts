import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // pdf.js v4 contains top-level await; Vite's default dev prebundle target
    // rewrites it as ES2020 and crashes before the app can load.
    exclude: ["pdfjs-dist"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name === "ara.traineddata.gz"
            ? "assets/[name][extname]"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
}));
