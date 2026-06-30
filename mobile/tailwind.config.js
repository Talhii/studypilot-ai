/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Soft pastel / minimalist palette.
        background: "#F6F5FF",
        surface: "#FFFFFF",
        primary: "#7C6FF0",
        "primary-soft": "#EAE7FF",
        accent: "#7AD7C9",
        "accent-soft": "#E4F7F3",
        peach: "#FFB5A7",
        "peach-soft": "#FFEDE8",
        ink: "#1F2233",
        muted: "#8A8FA8",
        line: "#ECECF5",
        success: "#5CC98F",
        danger: "#F2789F",
      },
      borderRadius: {
        xl2: "20px",
        xl3: "28px",
      },
    },
  },
  plugins: [],
};
