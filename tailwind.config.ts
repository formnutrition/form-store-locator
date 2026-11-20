import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        form: {
          black: "#282828",
          white: "#ffffff",
          cream: "#f7f5f0",
          stone: "#eeeeee",
          gold: "#e6d046",
          text: "#4A4A4A",
          muted: "#777777",
        },
      },
      fontFamily: {
        body: [
          "Avenir Next",
          "Avenir",
          "Segoe UI",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
