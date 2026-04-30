/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jade: {
          50:  '#edfdf5',
          100: '#d3f9e7',
          200: '#aaf0d1',
          300: '#73e3b5',
          400: '#3ecf8e',
          500: '#1db870',
          600: '#12975a',
          700: '#107948',
          800: '#0e5e39',
          900: '#0b4a2d',
        },
        // keep for backwards compat
        ink: {
          950: '#07070f',
          900: '#0e0e1a',
          800: '#141422',
          700: '#1c1c2e',
          600: '#24243c',
          500: '#2e2e4a',
          400: '#3d3d60',
        },
        arc: {
          950: '#07070f',
          900: '#0e0e1a',
          800: '#141422',
          700: '#1c1c2e',
          600: '#24243c',
          500: '#2e2e4a',
          400: '#3d3d60',
        },
      },
    },
  },
  plugins: [],
}
