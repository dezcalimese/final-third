import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#050b08",
          900: "#0a1710",
          800: "#0f2318",
        },
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "flash-hit": {
          "0%": { opacity: "0.9" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "pop-in": "pop-in 260ms cubic-bezier(0.16,1,0.3,1) forwards",
        "flash-hit": "flash-hit 420ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
