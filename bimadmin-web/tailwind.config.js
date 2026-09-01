/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "rgb(var(--color-paper) / <alpha-value>)",
          raised: "rgb(var(--color-paper-raised) / <alpha-value>)",
          sunk: "rgb(var(--color-paper-sunk) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
        },
        violet: {
          50: "#F1EEFF",
          100: "#DCD3FF",
          300: "#A78BFA",
          500: "#6D3CE5",
          600: "#5B2FC2",
          700: "#472399",
        },
        amber: {
          50: "#FFF4E5",
          100: "#FFE1B3",
          300: "#FFB84D",
          500: "#FF8A1E",
          600: "#E86F00",
        },
        emerald: {
          50: "#E7FBEF",
          100: "#B9F5D0",
          300: "#4ADE80",
          500: "#12B76A",
          600: "#0D8F52",
        },
        coral: {
          50: "#FFEDEA",
          100: "#FFD1C7",
          300: "#FF8F76",
          500: "#FF5A3C",
          600: "#E23E22",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        tab: "10px 10px 2px 2px",
        card: "16px",
        glass: "20px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(23 19 31 / 0.04), 0 1px 6px -1px rgb(23 19 31 / 0.06)",
        raised: "0 4px 16px -4px rgb(23 19 31 / 0.12)",
        glass: "0 8px 32px -8px rgb(109 60 229 / 0.18)",
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};
