import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Design System v2: Typography Scale
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.05em" }], // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.025em" }], // 14px
        base: ["1rem", { lineHeight: "1.5rem", letterSpacing: "0" }], // 16px
        lg: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.025em" }], // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.025em" }], // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.05em" }], // 24px
        "3xl": [
          "1.875rem",
          { lineHeight: "2.25rem", letterSpacing: "-0.05em" },
        ], // 30px
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.05em" }], // 36px
        "5xl": ["3rem", { lineHeight: "1", letterSpacing: "-0.05em" }], // 48px
      },
      fontWeight: {
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        black: "900",
      },
      lineHeight: {
        tight: "1.25",
        normal: "1.5",
        relaxed: "1.75",
      },
      // Design System v2: Colors (enhanced)
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        secondary: {
          // Using accent as secondary for now
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        error: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        gray: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
        },
        // Legacy colors for compatibility during transition
        "shift-primary": "#0f172a",
        "shift-surface": "#0b1222",
        "shift-border": "#1e293b",
        "shift-accent": "#38bdf8",
        "shift-warn": "#f97316",
      },
      // Design System v2: Shadow/Elevation System
      boxShadow: {
        "elevation-0": "none",
        "elevation-1": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "elevation-2":
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        "elevation-3":
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        "elevation-4":
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
        "elevation-5":
          "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        // Focus rings
        "focus-ring": "0 0 0 3px rgba(14, 165, 233, 0.2)",
        "focus-ring-error": "0 0 0 3px rgba(239, 68, 68, 0.2)",
        // Hover states
        "hover-elevation":
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        // Legacy
        card: "0 10px 40px -18px rgba(15,23,42,0.45)",
      },
      // Design System v2: Border Radius Scale
      borderRadius: {
        none: "0",
        sm: "0.25rem", // 4px
        base: "0.375rem", // 6px
        md: "0.5rem", // 8px
        lg: "0.75rem", // 12px
        xl: "12px", // 12px (keep for compatibility)
        "2xl": "16px", // 16px (keep for compatibility)
        "3xl": "1.5rem", // 24px
        full: "9999px",
      },
      // Design System v2: Border Width Scale
      borderWidth: {
        DEFAULT: "1px",
        "0": "0",
        "1": "1px",
        "2": "2px",
        "4": "4px",
      },
      // Design System v2: Spacing Scale (Tailwind default is already 4px base)
      // 0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px), 20 (80px), 24 (96px)
      // Already provided by Tailwind defaults - no changes needed
    },
  },
  plugins: [],
};

export default config;
