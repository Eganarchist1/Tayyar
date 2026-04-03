import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--bg-canvas)",
        base: "var(--bg-base)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          2: "var(--bg-surface-2)",
          overlay: "var(--bg-overlay)",
          elevated: "var(--bg-elevated)",
        },
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
        },
        accent: {
          500: "var(--accent-500)",
        },
        success: {
          400: "var(--success-400)",
          500: "var(--success-500)",
          600: "var(--success-600)",
        },
        warning: {
          400: "var(--warning-400)",
          500: "var(--warning-500)",
          600: "var(--warning-600)",
        },
        danger: {
          400: "var(--danger-400)",
          500: "var(--danger-500)",
          600: "var(--danger-600)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
        },
      },
      fontFamily: {
        'display-ar': ["var(--font-display-ar)", "sans-serif"],
        'body-ar': ["var(--font-body-ar)", "sans-serif"],
        'kufi-ar': ["var(--font-kufi-ar)", "sans-serif"],
        'display': ["var(--font-display)", "sans-serif"],
        'body': ["var(--font-body)", "sans-serif"],
        'mono': ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        'glow-sky': "0 0 20px var(--primary-glow)",
        'glow-gold': "0 0 20px var(--accent-glow)",
      },
      animation: {
        'fade-up': 'fadeUp 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-in': 'slideInLeft 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
