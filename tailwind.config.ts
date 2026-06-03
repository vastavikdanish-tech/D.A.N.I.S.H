import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        panel: "hsl(var(--panel))",
        cyan: {
          electric: "#35d9ff",
          soft: "#78edf8"
        },
        mint: "#55f2c6",
        amber: "#ffd166",
        danger: "#ff5b7e"
      },
      boxShadow: {
        glow: "0 0 30px rgba(53,217,255,0.24)",
        panel: "0 24px 80px rgba(0,0,0,0.38)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"]
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.86)", opacity: "0.55" },
          "70%": { transform: "scale(1.12)", opacity: "0.08" },
          "100%": { transform: "scale(1.18)", opacity: "0" }
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" }
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-10px,0)" }
        }
      },
      animation: {
        "pulse-ring": "pulseRing 2.2s ease-out infinite",
        wave: "wave 1.15s ease-in-out infinite",
        drift: "drift 7s ease-in-out infinite"
      }
    }
  },
  plugins: [animate]
};

export default config;
