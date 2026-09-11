import type { Config } from "tailwindcss";
import sharedConfig from "@ecom/ui/tailwind.config";

const config: Pick<Config, "content" | "presets"> = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [sharedConfig],
};

export default config;
