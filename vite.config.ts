import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/auwebbity/",
  plugins: [solid(), tailwindcss()],
  worker: {
    format: "es",
  },
});
