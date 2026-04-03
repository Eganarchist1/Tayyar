module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          charcoal: "#0A0A0A",
          gold: "#D4AF37",
          crimson: "#DC143C",
          emerald: "#2E8B57",
          blue: "#007FFF",
        },
      },
      fontFamily: {
        heading: ["ReadexPro-Bold"],
        sans: ["Inter-Regular"],
      },
    },
  },
  plugins: [],
};
