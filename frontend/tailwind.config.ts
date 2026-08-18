import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow:       '#F0C33C',
          'yellow-dim': '#C49A1E',
          purple:       '#7C3AED',
          'purple-light':'#A78BFA',
          'purple-dim': '#5B21B6',
          black:        '#0A0A0A',
          surface:      '#111111',
          'surface-2':  '#1A1A1A',
          'surface-3':  '#242424',
          border:       '#2A2A2A',
          muted:        '#6B7280',
          text:         '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        blob:       'blob 8s ease-in-out infinite',
        'blob-2':   'blob 10s ease-in-out infinite reverse',
        'fade-in':  'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-dot':'pulseDot 1.4s ease-in-out infinite',
        'level-in': 'levelIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'scan':     'scan 2s linear infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':      { transform: 'translate(30px,-50px) scale(1.1)' },
          '66%':      { transform: 'translate(-20px,20px) scale(0.9)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0' },
          '40%':            { transform: 'scale(1)', opacity: '1' },
        },
        levelIn: {
          from: { opacity: '0', transform: 'scale(0.5)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        scan: {
          '0%':   { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-yellow': '0 0 20px rgba(240,195,60,0.25)',
        'glow-purple': '0 0 20px rgba(124,58,237,0.3)',
        'card':        '0 1px 3px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
} satisfies Config
