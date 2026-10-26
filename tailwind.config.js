/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zuno: {
          night: '#0f0a2c',
          twilight: '#1e1b4b',
          violet: '#9810fa',
          cyan: '#00f2fe',
          gold: '#fbbf24',
          coral: '#fb7185',
          lavender: '#e9d5ff',
          emerald: '#34d399',
        },
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 32px rgba(0, 242, 254, 0.45)',
        'glow-violet': '0 0 32px rgba(152, 16, 250, 0.5)',
        'glow-gold': '0 0 32px rgba(251, 191, 36, 0.5)',
        'glow-coral': '0 0 32px rgba(251, 113, 133, 0.45)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.25' },
          '50%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 18px rgba(0, 242, 254, 0.35)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 242, 254, 0.75)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-6deg)' },
          '75%': { transform: 'rotate(6deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)', opacity: '0.2' },
          '25%': { transform: 'translate(18px, -24px)', opacity: '0.9' },
          '50%': { transform: 'translate(-12px, -40px)', opacity: '0.5' },
          '75%': { transform: 'translate(-24px, -12px)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        'pop-in': 'pop-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) both',
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        wiggle: 'wiggle 0.45s ease-in-out',
        shimmer: 'shimmer 3s linear infinite',
        drift: 'drift 9s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
