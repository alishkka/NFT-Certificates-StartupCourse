import { defineConfig, mergeConfig } from "vite";
import staticDemo from "./vite.pages.config";

export default mergeConfig(staticDemo, defineConfig({
  base: "/",
  build: { outDir: "dist-vercel", emptyOutDir: true },
}));
