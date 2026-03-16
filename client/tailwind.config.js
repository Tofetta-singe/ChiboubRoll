/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        dark: {
          900: '#0a0a1a',
          800: '#12122a',
          700: '#1a1a3a',
          600: '#252550',
        },
        gold: {
          DEFAULT: '#f5a623',
          light: '#ffd700',
          dark: '#c8860a',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
        },
      },
      animation: {
        'spin-wheel': 'spinWheel 3s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards',
        'float-up': 'floatUp 1.2s ease-out forwards',
        'pop': 'pop 0.4s ease',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) scale(0.3)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(245, 166, 35, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 166, 35, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
