/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        moss: {
          50: '#e8ece6',
          100: '#d4dbd0',
          200: '#b5c4ad',
          300: '#8fa882',
          400: '#5c6d55',
          500: '#3f4f3a',
          600: '#2d3a28',
          700: '#1e2d28',
          800: '#162118',
          900: '#0e1a13',
        },
        leaf: {
          50: '#edf2e6',
          100: '#dbe6cf',
          200: '#c4d6af',
          300: '#b5d098',
          400: '#98b874',
          500: '#7fa850',
          600: '#6d9440',
          700: '#4a5d23',
        },
        earth: {
          300: '#b8ada3',
          400: '#a09888',
          500: '#8c7e72',
          600: '#5c544e',
        },
        paper: {
          50: '#faf9f6',
          100: '#f0f4f1',
          200: '#e8ece6',
          300: '#dde2db',
        },
        coral: {
          100: '#fce0db',
          200: '#f0c4bc',
          300: '#e0a89e',
          400: '#d4887a',
          500: '#c26a5a',
          600: '#a85548',
        },
      },
    },
  },
  plugins: [],
}
