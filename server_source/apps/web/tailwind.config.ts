import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        vinho: {
          950: "#2A0D11",
          900: "#4A1115",
          800: "#6B1F26",
          100: "#F7F0E8",
          50: "#FBF8F5"
        },
        ouro: {
          500: "#A67C52",
          400: "#C49A6C"
        },
        grafite: "#2B211F"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(26, 20, 18, 0.08)"
      }
    },
  },
  plugins: [],
};

export default config;
