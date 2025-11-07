import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import LayoutWithStreamSelection from '@/components/layout/LayoutWithStreamSelection'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'NeetLogIQ - Your Medical Education Guide',
  description: 'Comprehensive guide to medical education in India. Find the best colleges, courses, and cutoffs for your NEET journey.',
  keywords: 'NEET, medical colleges, MBBS, BDS, medical education, India, cutoffs, courses',
  authors: [{ name: 'NeetLogIQ Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'NeetLogIQ - Your Medical Education Guide',
    description: 'Comprehensive guide to medical education in India. Find the best colleges, courses, and cutoffs for your NEET journey.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NeetLogIQ - Your Medical Education Guide',
    description: 'Comprehensive guide to medical education in India. Find the best colleges, courses, and cutoffs for your NEET journey.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else if (!theme) {
                    // Check system preference if no saved theme
                    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      document.documentElement.classList.add('dark');
                      document.documentElement.style.colorScheme = 'dark';
                    } else {
                      document.documentElement.style.colorScheme = 'light';
                    }
                  } else {
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {
                  // Ignore errors in case localStorage is not available
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <LayoutWithStreamSelection>
              {children}
            </LayoutWithStreamSelection>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}