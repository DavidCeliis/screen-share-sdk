import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  noExternal: ["@microsoft/signalr"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
