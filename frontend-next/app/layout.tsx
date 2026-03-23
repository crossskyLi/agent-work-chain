import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Audit Swarm Console',
  description: 'Independent third-party audit infrastructure for AI agents',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
