import type { Metadata, Viewport } from 'next'
<<<<<<< Updated upstream
import { Inter } from 'next/font/google'
=======
>>>>>>> Stashed changes
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { StreamProvider } from '@/contexts/StreamContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { PremiumProvider } from '@/contexts/PremiumContext'
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import LayoutWithStreamSelection from '@/components/layout/LayoutWithStreamSelection'
import StreamGuard from '@/components/StreamGuard'
import ErrorBoundary from '@/components/common/ErrorBoundary'

<<<<<<< Updated upstream
const inter = Inter({ subsets: ['latin'] })

=======
>>>>>>> Stashed changes
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
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <PremiumProvider>
<<<<<<< Updated upstream
                <AuthGuard>
=======
                <UserPreferencesProvider>
>>>>>>> Stashed changes
                  <StreamProvider>
                    <StreamGuard>
                      <LayoutWithStreamSelection>
                        {children}
                      </LayoutWithStreamSelection>
                    </StreamGuard>
                  </StreamProvider>
<<<<<<< Updated upstream
                </AuthGuard>
=======
                </UserPreferencesProvider>
>>>>>>> Stashed changes
              </PremiumProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}