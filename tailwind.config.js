/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: '#f8fafc',
        card: '#ffffff',
        ink: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          muted: '#64748b',
        },
        line: '#e2e8f0',
        success: {
          DEFAULT: '#16a34a',
          bg: '#dcfce7',
        },
        warning: {
          DEFAULT: '#d97706',
          bg: '#fef3c7',
        },
        danger: {
          DEFAULT: '#dc2626',
          bg: '#fee2e2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
