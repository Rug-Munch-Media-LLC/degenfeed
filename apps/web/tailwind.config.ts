import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        degen: {
          50: '#e6ffec',
          100: '#b3ffcc',
          200: '#80ffad',
          300: '#4dff8d',
          400: '#1aff6e',
          500: '#00ff41',
          600: '#00cc34',
          700: '#009927',
          800: '#00661a',
          900: '#00330d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
