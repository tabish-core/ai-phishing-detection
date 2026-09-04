/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#fdfbf7',
          warm: '#fdfbf7',
          muted: '#e5e0d8',
          postit: '#fff9c4',
          ink: '#2d2d2d',
        },
        pencil: {
          DEFAULT: '#2d2d2d',
          soft: '#2d2d2d',
          muted: '#7a7a7a',
        },
        marker: {
          red: '#ff4d4d',
          pen: '#2d5da1',
          yellow: '#fff9c4',
        },
      },
      fontFamily: {
        hand: ['"Patrick Hand"', '"Kalam"', 'cursive'],
        marker: ['"Kalam"', '"Patrick Hand"', 'cursive'],
      },
      boxShadow: {
        cut: '4px 4px 0px 0px #2d2d2d',
        'cut-lg': '8px 8px 0px 0px #2d2d2d',
        'cut-red': '4px 4px 0px 0px #ff4d4d',
        'cut-pen': '4px 4px 0px 0px #2d5da1',
        'cut-sm': '3px 3px 0px 0px rgba(45,45,45,0.1)',
        'cut-press': '0px 0px 0px 0px #2d2d2d',
      },
      borderRadius: {
        wob: '255px 15px 225px 15px / 15px 225px 15px 255px',
        wobMd: '20px 8px 25px 10px / 12px 22px 10px 20px',
        wobLg: '40px 14px 36px 22px / 18px 38px 18px 42px',
        wobSm: '18px 6px 22px 8px / 8px 18px 8px 18px',
        tag: '14px 22px 14px 22px / 22px 14px 22px 14px',
      },
      keyframes: {
        bounce2: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        bounce2: 'bounce2 3s ease-in-out infinite',
        wiggle: 'wiggle 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}