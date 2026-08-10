import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#102A43", ocean: "#146C94", mist: "#F5F8FA", gold: "#E9B44C" },
      boxShadow: { soft: "0 18px 45px rgba(16, 42, 67, 0.10)" },
    },
  },
  plugins: [],
};

export default config;
