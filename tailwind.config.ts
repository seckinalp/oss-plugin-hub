import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Platform colors - safelist to prevent purging
    'bg-purple-100', 'text-purple-800', 'dark:bg-purple-900', 'dark:text-purple-200',
    'bg-blue-100', 'text-blue-800', 'dark:bg-blue-900', 'dark:text-blue-200',
    'bg-orange-100', 'text-orange-800', 'dark:bg-orange-900', 'dark:text-orange-200',
    'bg-cyan-100', 'text-cyan-800', 'dark:bg-cyan-900', 'dark:text-cyan-200',
    'bg-rose-100', 'text-rose-800', 'dark:bg-rose-900', 'dark:text-rose-200',
    'bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-200',
    'bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900', 'dark:text-yellow-200',
    'bg-lime-100', 'text-lime-800', 'dark:bg-lime-900', 'dark:text-lime-200',
    'bg-emerald-100', 'text-emerald-800', 'dark:bg-emerald-900', 'dark:text-emerald-200',
    'bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-200',
    'bg-teal-100', 'text-teal-800', 'dark:bg-teal-900', 'dark:text-teal-200',
    'bg-indigo-100', 'text-indigo-800', 'dark:bg-indigo-900', 'dark:text-indigo-200',
    'bg-slate-100', 'text-slate-800', 'dark:bg-slate-900', 'dark:text-slate-200',
    // Health status colors
    'bg-green-50', 'bg-yellow-50', 'bg-orange-50', 'bg-red-50',
    'text-green-700', 'text-yellow-700', 'text-orange-700', 'text-red-700',
    'dark:bg-green-900/20', 'dark:bg-yellow-900/20', 'dark:bg-orange-900/20', 'dark:bg-red-900/20',
    'dark:text-green-300', 'dark:text-yellow-300', 'dark:text-orange-300', 'dark:text-red-300',
    // Top 100 badge
    'bg-amber-100', 'text-amber-800', 'dark:bg-amber-900', 'dark:text-amber-200',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;

