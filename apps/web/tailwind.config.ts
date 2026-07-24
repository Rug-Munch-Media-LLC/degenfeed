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
        cosmic: {
          50: '#f3e8ff',
          100: '#e0b2ff',
          200: '#c77dff',
          300: '#b147f9',
          400: '#9b1ef7',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        surface: {
          DEFAULT: '#000000',
          card: '#0a0a0a',
          elevated: '#141416',
          hover: '#111113',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Syne', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        display: ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        hero: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'heart-pop': {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.3)' },
          '50%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        'orbit-spin': {
          '0%': { transform: 'rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg)' },
        },
        'orbit-spin-reverse': {
          '0%': { transform: 'rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg)' },
          '100%': { transform: 'rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px var(--color-accent-glow)' },
          '50%': { boxShadow: '0 0 24px var(--color-accent-glow-strong)' },
        },
        'particle-burst': {
          '0%': { opacity: '1', transform: 'translate(0, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'var(--particle-end) scale(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-left': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'new-posts-slide': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '60%': { transform: 'translateY(4px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'notification-pulse': {
          '0%': { boxShadow: '0 0 0 0 var(--color-accent-glow-strong)' },
          '70%': { boxShadow: '0 0 0 8px transparent' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
        'ticker-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'zap-flash': {
          '0%': { opacity: '0', transform: 'scale(0.5) rotate(-10deg)' },
          '30%': { opacity: '1', transform: 'scale(1.2) rotate(5deg)' },
          '60%': { opacity: '1', transform: 'scale(0.95) rotate(-2deg)' },
          '100%': { opacity: '0', transform: 'scale(1.5) rotate(0deg) translateY(-20px)' },
        },
        'streak-flame': {
          '0%, 100%': { transform: 'scaleY(1) scaleX(1)', opacity: '0.8' },
          '25%': { transform: 'scaleY(1.15) scaleX(0.9)', opacity: '1' },
          '50%': { transform: 'scaleY(0.95) scaleX(1.05)', opacity: '0.9' },
          '75%': { transform: 'scaleY(1.1) scaleX(0.95)', opacity: '1' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'bounce-spring': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.15)' },
          '50%': { transform: 'scale(0.95)' },
          '70%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)' },
        },
        'ptr-spring': {
          '0%': { transform: 'translateY(0) scale(1)' },
          '30%': { transform: 'translateY(-6px) scale(1.08)' },
          '50%': { transform: 'translateY(0) scale(0.96)' },
          '70%': { transform: 'translateY(-2px) scale(1.02)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        'ptr-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'slide-tab': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.5s var(--ease-out-expo)',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'heart-pop': 'heart-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'orbit-spin': 'orbit-spin 8s linear infinite',
        'orbit-spin-reverse': 'orbit-spin-reverse 12s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'particle-burst': 'particle-burst 0.6s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'scale-in': 'scale-in 0.25s ease-out',
        'new-posts-slide': 'new-posts-slide 0.4s ease-out',
        'notification-pulse': 'notification-pulse 2s ease-in-out infinite',
        'ticker-scroll': 'ticker-scroll 30s linear infinite',
        'zap-flash': 'zap-flash 0.5s ease-out forwards',
        'streak-flame': 'streak-flame 1.5s ease-in-out infinite',
        'loading-bar': 'loading-bar 1.2s ease-in-out infinite',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'bounce-spring': 'bounce-spring 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ptr-spring': 'ptr-spring 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ptr-spin': 'ptr-spin 0.8s linear infinite',
        'slide-tab': 'slide-tab 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'new-posts-slide 0.35s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
