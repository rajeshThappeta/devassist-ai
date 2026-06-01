/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pink: {
          950: '#3D0019',
          900: '#6B0032',
          800: '#8B0040',
          700: '#A50050',
          600: '#C2185B',
          500: '#D81B60',
          400: '#E91E8C',
          300: '#F06292',
          200: '#F48FB1',
          100: '#FCE4EC',
          50:  '#FFF0F5',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      animation: {
        'slide-in': 'slideIn 0.25s ease forwards',
        'fade-in':  'fadeIn 0.2s ease forwards',
      },
      keyframes: {
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
