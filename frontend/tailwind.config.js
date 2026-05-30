/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10211d",
        forest: "#123d35",
        moss: "#1d6657",
        ember: "#e76f43",
        cream: "#f7f4ed",
        sand: "#e9e4d9",
      },
      boxShadow: {
        card: "0 12px 35px rgba(16, 33, 29, 0.07)",
      },
    },
  },
  plugins: [],
};

