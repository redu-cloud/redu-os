/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#5b5bff',
          600: '#4d4dff',
          700: '#3a3aff',
          900: '#1a1a66',
        },
        accent: {
          400: '#a78bfa',
          500: '#9333ea',
          600: '#7e22ce',
        },
      },
    },
  },
  plugins: [],
};
