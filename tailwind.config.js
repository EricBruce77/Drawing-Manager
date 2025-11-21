/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aro-blue': '#1e40af',
        'aro-dark': '#1e293b',
      }
    },
  },
  plugins: [],
}