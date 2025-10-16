/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0f1218", soft: "#151923", card: "#171B26" },
        text: { DEFAULT: "#D6D9E0", muted: "#9AA3B2" },
        line: "#232838",
        accent: { DEFAULT: "#E11D74", soft: "#FCE7F1" },
      },
      boxShadow: { card: "0 6px 18px rgba(0,0,0,.25)" },
    },
  },
  plugins: [],
};
