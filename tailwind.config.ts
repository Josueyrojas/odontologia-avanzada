import type { Config } from "tailwindcss";

// Los colores de superficie y texto salen de variables CSS (globals.css) para soportar modo oscuro.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0F2A44", 700: "#163A5C", 300: "#9FB4C9" },
        brand: { DEFAULT: "#12A36A", dark: v("brand-dark"), soft: v("brand-soft") },
        warn: "#F2B33D",
        danger: "#D9483B",
        cost: "#E8893A",
        bg: v("bg"),
        surface: v("surface"),
        ink: { DEFAULT: v("ink"), soft: v("ink-soft") },
        muted: v("muted"),
        line: v("line"),
        edge: v("edge"),
      },
      fontFamily: { sans: ["var(--font-jakarta)", "system-ui", "sans-serif"] },
      keyframes: {
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: { from: { opacity: "0", transform: "translateY(12px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        slide: { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "none" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        fade: "fade .18s ease-out",
        pop: "pop .22s cubic-bezier(.2,.9,.3,1.2)",
        slide: "slide .25s ease-out",
        rise: "rise .35s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
