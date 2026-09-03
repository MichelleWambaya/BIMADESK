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
        /* Deep teal. Named `violet` for now because roughly a hundred
           files reference violet-500; renaming the scale would mean
           editing all of them, which is not a risk worth taking on a live
           product for a colour change. Rename in a quiet week. */
        violet: {
          50: "#E8F0EF",
          100: "#C6DAD8",
          300: "#5F9A96",
          500: "#1F6E68",
          600: "#155852",
          700: "#0E403C",
        },
        /* Ochre rather than orange. Sits against the teal without
           either one shouting. */
        amber: {
          50: "#FBF2DF",
          100: "#F3DFB0",
          300: "#DFAF46",
          500: "#C68A2E",
          600: "#A26D1E",
        },
        emerald: {
          50: "#E6F2E8",
          100: "#BFDFC6",
          300: "#6FAE7D",
          500: "#3B8A4E",
          600: "#2C6B3B",
        },
        coral: {
          50: "#FBEAE5",
          100: "#F3C9BC",
          300: "#DC8065",
          500: "#C1512F",
          600: "#9C3D20",
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
