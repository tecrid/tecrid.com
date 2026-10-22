import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": fileURLToPath(new URL("./tests/support/cloudflare-env.ts", import.meta.url)),
      "next/link": fileURLToPath(new URL("./tests/support/next-link.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./tests/support/next-navigation.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
