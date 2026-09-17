import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#fafafa",
        surface: "#ffffff",
        border: "#e5e7eb",
        ink: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
          faint: "#94a3b8",
        },
        brand: {
          DEFAULT: "#4f46e5",
          soft: "#eef2ff",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px 0 rgb(0 0 0 / 0.02)",
      },
    },
  },
  plugins: [],
};

export default config;
