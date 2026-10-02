import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          forest: "#163300",
          lime: "#9fe870",
          spruce: "#054d28",
          linen: "#e2f6d5",
          red: "#cb272f",
          blue: "#0b4c72",
          charcoal: "#454745",
          obsidian: "#0e0f0c",
          pebble: "#868685",
          slate: "#6a6c6a",
          fog: "#e8ebe6",
          foglight: "#f6f8f5",
          paper: "#ffffff",
        },
      },
      borderRadius: {
        card: "14px",
        hero: "24px",
        pill: "9999px",
      },
      boxShadow: {
        subtle: "rgba(14, 15, 12, 0.08) 0px 0px 0px 1px",
        card: "0 2px 8px rgba(22, 51, 0, 0.06)",
        float: "0 12px 32px rgba(22, 51, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
