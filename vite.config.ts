import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";
import { basename, extname } from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const entry = Object.fromEntries(
  readdirSync(resolve(__dirname, "src/schemas"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => [basename(f, extname(f)), resolve(__dirname, "src/schemas", f)])
);

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
    }),
  ],
  build: {
    lib: {
      entry,
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["zod", /^zod\/.*/],
    },
    sourcemap: true,
  },
});
