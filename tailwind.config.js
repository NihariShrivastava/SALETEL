/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d0f1a',
          secondary: '#151827',
          card: '#1a1d2e',
          hover: '#1e2235',
          border: '#252840',
        },
        accent: {
          blue: '#4f6ef7',
          purple: '#6c63ff',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          cyan: '#06b6d4',
        },
        text: {
          primary: '#ffffff',
          secondary: '#94a3b8',
          muted: '#64748b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
