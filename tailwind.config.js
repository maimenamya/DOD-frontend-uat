/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      /** App shell + open-table: mobile below 800px, desktop from 800px up. */
      desktop: '800px',
    },
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        surface: 'var(--surface)',
        'surface-strong': 'var(--surface-strong)',
        'theme-border': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-primary-dark': 'var(--text-primary-dark)',
        'text-secondary': 'var(--text-secondary)',
        'text-label': 'var(--text-label)',
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
        },
        'theme-accent': {
          DEFAULT: 'var(--text-accent)',
          strong: 'var(--text-accent-strong)',
        },
        'on-warning': 'var(--text-on-warning)',
        glow: 'var(--glow)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderRadius: {
        glass: 'var(--radius-glass)',
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        glow: 'var(--shadow-glow)',
        'glow-sm': 'var(--shadow-glow-sm)',
        'neon-button': 'var(--shadow-button)',
        'neon-button-hover': 'var(--shadow-button-hover)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      fontSize: {
        'page-title': ['var(--text-page-title)', { lineHeight: 'var(--leading-tight)' }],
        'card-title': ['var(--text-card-title)', { lineHeight: 'var(--leading-snug)' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'float-glow': 'floatGlow 8s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatGlow: {
          '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' },
          '50%': { transform: 'translate(-50%, -48%) scale(1.05)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: 'var(--shadow-button)' },
          '50%': { boxShadow: 'var(--shadow-button-pulse)' },
        },
      },
    },
  },
  plugins: [],
};
