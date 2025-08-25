/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Enhanced color system
      colors: {
        // Core shadcn/ui colors - enhanced
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Modern Healthcare Color System
        healthcare: {
          // Primary Blue Scale
          primary: {
            50: "hsl(var(--healthcare-primary-50))",
            100: "hsl(var(--healthcare-primary-100))",
            200: "hsl(var(--healthcare-primary-200))",
            300: "hsl(var(--healthcare-primary-300))",
            400: "hsl(var(--healthcare-primary-400))",
            500: "hsl(var(--healthcare-primary-500))",
            600: "hsl(var(--healthcare-primary-600))",
            700: "hsl(var(--healthcare-primary-700))",
            800: "hsl(var(--healthcare-primary-800))",
            900: "hsl(var(--healthcare-primary-900))",
            950: "hsl(var(--healthcare-primary-950))",
            DEFAULT: "hsl(var(--healthcare-primary))",
          },
          
          // Secondary Gray Scale
          secondary: {
            50: "hsl(var(--healthcare-secondary-50))",
            100: "hsl(var(--healthcare-secondary-100))",
            200: "hsl(var(--healthcare-secondary-200))",
            300: "hsl(var(--healthcare-secondary-300))",
            400: "hsl(var(--healthcare-secondary-400))",
            500: "hsl(var(--healthcare-secondary-500))",
            600: "hsl(var(--healthcare-secondary-600))",
            700: "hsl(var(--healthcare-secondary-700))",
            800: "hsl(var(--healthcare-secondary-800))",
            900: "hsl(var(--healthcare-secondary-900))",
            950: "hsl(var(--healthcare-secondary-950))",
            DEFAULT: "hsl(var(--healthcare-secondary))",
          },
          
          // Accent & State Colors
          accent: "hsl(var(--healthcare-accent))",
          "accent-warm": "hsl(var(--healthcare-accent-warm))",
          success: "hsl(var(--healthcare-success))",
          warning: "hsl(var(--healthcare-warning))",
          error: "hsl(var(--healthcare-error))",
          info: "hsl(var(--healthcare-info))",
          
          // Surface Colors
          background: "hsl(var(--healthcare-background))",
          surface: "hsl(var(--healthcare-surface))",
          "surface-elevated": "hsl(var(--healthcare-surface-elevated))",
          "surface-overlay": "hsl(var(--healthcare-surface-overlay))",
          
          // Text Colors
          text: {
            primary: "hsl(var(--healthcare-text-primary))",
            secondary: "hsl(var(--healthcare-text-secondary))",
            muted: "hsl(var(--healthcare-text-muted))",
            disabled: "hsl(var(--healthcare-text-disabled))",
          },
          
          // Interactive States
          hover: "hsl(var(--healthcare-hover))",
          active: "hsl(var(--healthcare-active))",
          focus: "hsl(var(--healthcare-focus))",
          selected: "hsl(var(--healthcare-selected))",
        },
      },
      
      // Enhanced typography system
      fontFamily: {
        sans: "var(--font-family-sans)",
        display: "var(--font-family-display)",
        mono: "var(--font-family-mono)",
      },
      
      fontWeight: {
        light: "var(--font-weight-light)",
        normal: "var(--font-weight-normal)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
        extrabold: "var(--font-weight-extrabold)",
      },
      
      lineHeight: {
        none: "var(--line-height-none)",
        tight: "var(--line-height-tight)",
        snug: "var(--line-height-snug)",
        normal: "var(--line-height-normal)",
        relaxed: "var(--line-height-relaxed)",
        loose: "var(--line-height-loose)",
      },
      
      letterSpacing: {
        tighter: "var(--letter-spacing-tighter)",
        tight: "var(--letter-spacing-tight)",
        normal: "var(--letter-spacing-normal)",
        wide: "var(--letter-spacing-wide)",
        wider: "var(--letter-spacing-wider)",
        widest: "var(--letter-spacing-widest)",
      },
      
      // Enhanced border radius system
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
      },
      
      // Enhanced spacing system
      spacing: {
        px: "var(--space-px)",
        0: "var(--space-0)",
        0.5: "var(--space-0-5)",
        1: "var(--space-1)",
        1.5: "var(--space-1-5)",
        2: "var(--space-2)",
        2.5: "var(--space-2-5)",
        3: "var(--space-3)",
        3.5: "var(--space-3-5)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        20: "var(--space-20)",
        24: "var(--space-24)",
        32: "var(--space-32)",
        40: "var(--space-40)",
        48: "var(--space-48)",
        56: "var(--space-56)",
        64: "var(--space-64)",
      },
      
      // Enhanced box shadow system
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        inner: "var(--shadow-inner)",
      },
      
      // Enhanced transition system
      transitionDuration: {
        75: "var(--duration-75)",
        100: "var(--duration-100)",
        150: "var(--duration-150)",
        200: "var(--duration-200)",
        300: "var(--duration-300)",
        500: "var(--duration-500)",
        700: "var(--duration-700)",
        1000: "var(--duration-1000)",
      },
      
      transitionTimingFunction: {
        linear: "var(--ease-linear)",
        in: "var(--ease-in)",
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      
      // Enhanced keyframes and animations
      keyframes: {
        // Existing shadcn animations
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        
        // New modern animations
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
      
      animation: {
        // Existing animations
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        
        // New modern animations
        "fade-in": "fade-in 0.3s ease-in-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "shimmer": "shimmer 2s infinite linear",
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-subtle": "bounce-subtle 1s infinite",
        
        // Loading states
        "spin-slow": "spin 3s linear infinite",
        "ping-slow": "ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Add custom plugin for healthcare utilities
    function({ addUtilities }) {
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.gradient-primary': {
          'background': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--healthcare-accent)) 100%)',
        },
        '.gradient-secondary': {
          'background': 'linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)',
        },
        '.surface-blur': {
          'backdrop-filter': 'blur(8px)',
          'background': 'hsl(var(--background) / 0.8)',
        },
      });
    },
  ],
}