/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#104c91',
          dark: '#0a356b',
          light: '#256ebf',
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#badcff',
          300: '#8ac4ff',
          400: '#54a3ff',
          500: '#2b82fa',
          600: '#1561e1',
          700: '#104c91',
          800: '#13407c',
          900: '#143868',
        },
        secondary: {
          DEFAULT: '#00a651',
          dark: '#00823e',
          light: '#1ecb73',
          50: '#effef5',
          100: '#d7fee7',
          200: '#b1fdd0',
          300: '#75f9b1',
          400: '#34f08e',
          500: '#0bd570',
          600: '#00b45a',
          700: '#00a651',
          800: '#04713c',
          900: '#055d34',
        },
        accent: {
          DEFAULT: '#F97316',
          dark: '#EA580C',
          light: '#FB923C',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        body: {
          light: '#F8FAFC',
          dark: '#0F172A',
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-in-right': 'slideInRight 0.25s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
