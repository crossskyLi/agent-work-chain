import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(56,189,248,0.25), 0 12px 36px rgba(37,99,235,0.25)',
      },
      backgroundImage: {
        grid:
          'radial-gradient(circle at 1px 1px, rgba(125,211,252,0.12) 1px, transparent 0)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
    },
  },
  plugins: [],
};

export default config;
