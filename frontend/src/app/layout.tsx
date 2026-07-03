import type { Metadata } from 'next'
import './globals.css'
import '@/styles/theme.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/Toast'
import AppShell from '@/components/AppShell'
import { LauraProvider } from '@/components/laura/LauraProvider'
import LauraPill from '@/components/laura/LauraPill'
import LauraChat from '@/components/laura/LauraChat'

export const metadata: Metadata = {
  title: 'LAURA - LOA Automation',
  description: 'LOA Automation & Review Agent - AI to Market x EssilorLuxottica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <LauraProvider>
              <AppShell>{children}</AppShell>
              <LauraPill />
              <LauraChat />
            </LauraProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
