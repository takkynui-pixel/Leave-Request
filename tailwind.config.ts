import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#bcd2ff',
          300: '#8fb4fb',
          400: '#6b9bf5',
          500: '#3b78ef',
          600: '#2563eb',
          700: '#1d4fd0',
        },
        ink: '#1b2750',
      },
      fontFamily: {
        sans: ['var(--font-prompt)', 'Prompt', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(27,39,80,.04), 0 8px 24px rgba(27,39,80,.05)',
      },
    },
  },
  plugins: [],
};
export default config;
