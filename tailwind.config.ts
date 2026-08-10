import type { Config } from "tailwindcss";

/**
 * Diana's OS brand system.
 * Colors and fonts come straight from the PRD §11 (Luxury With a Pulse).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: "#2C1F14", // primary text / header
        cream: "#F5F0E8", // background canvas
        terracotta: "#A8562E", // primary accent / CTAs
        bronze: "#8A5A2B",
        tan: "#C4A882", // borders / muted
        oxblood: "#6B1F2A", // alerts / urgent
        blush: "#DDA98C", // soft highlights
      },
      fontFamily: {
        // Wired to next/font CSS variables (see app/layout.tsx).
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        script: ["var(--font-parisienne)", "cursive"],
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(44, 31, 20, 0.04), 0 8px 24px rgba(44, 31, 20, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
