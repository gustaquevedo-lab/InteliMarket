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
        posDisplay: ['Archivo Expanded', 'Inter', 'system-ui', 'sans-serif'],
        posMono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          orange: '#FF7019',
          orangeInk: '#C64E00',
          navy: '#002665',
        },
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
          DEFAULT: '#3AAFA9',
          dark: '#2D908B',
          light: '#4DC9C3',
          50: '#E6F7F6',
          100: '#C0EBE9',
          200: '#96DDDA',
          300: '#6CCFCB',
          400: '#4DC5C0',
          500: '#3AAFA9',
          600: '#339E98',
          700: '#2D908B',
          800: '#267F7A',
          900: '#1A605C',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        body: {
          light: '#F0F4F8',
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
          // Usa margin-top en vez de transform: translateY -- un transform activo
          // (incluso "translateY(0)" al terminar la animacion, con forwards) crea un
          // containing block nuevo para cualquier descendiente position:fixed, y eso
          // rompe el centrado de TODOS los modales (.modal-overlay) que queden anidados
          // dentro de un wrapper de pagina con esta animacion -- el modal termina
          // fijo contra el wrapper (alto como toda la lista) en vez de la pantalla.
          '0%': { opacity: '0', marginTop: '10px' },
          '100%': { opacity: '1', marginTop: '0' },
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
