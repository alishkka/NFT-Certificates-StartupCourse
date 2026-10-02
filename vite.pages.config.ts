import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages serves a static, read-only client. No Sites auth or server needed.
export default defineConfig({
  base: "/NFT-Certificates-StartupCourse/",
  plugins: [react()],
  define: { "process.env.NEXT_PUBLIC_DEMO_MODE": JSON.stringify("true") },
  resolve: { alias: [
    { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    { find: /^buffer$/, replacement: fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url)) },
    { find: /^crypto$/, replacement: fileURLToPath(new URL("./lib/browser-crypto.ts", import.meta.url)) },
    { find: /^stream$/, replacement: fileURLToPath(new URL("./node_modules/readable-stream/readable-browser.js", import.meta.url)) },
    { find: /^util$/, replacement: fileURLToPath(new URL("./node_modules/util/util.js", import.meta.url)) },
  ] },
  build: { outDir: "dist-pages", emptyOutDir: true },
});
