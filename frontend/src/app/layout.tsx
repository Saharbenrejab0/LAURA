import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import '@/styles/theme.css'
import '@/styles/redesign.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/Toast'
import AppShell from '@/components/AppShell'
import { LauraProvider } from '@/components/laura/LauraProvider'
import LauraChat from '@/components/laura/LauraChat'

export const metadata: Metadata = {
  title: 'LAURA - LOA Automation',
  description: 'LOA Automation & Review Agent - AI to Market x EssilorLuxottica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking theme script: runs before first paint so dark-mode users
            never see a flash of the light theme on reload. Reads the same
            localStorage key that useTheme writes. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('laura.theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}if(t==='dark'){var h=document.documentElement;h.classList.add('dark');h.setAttribute('data-theme','dark');}}catch(e){}})();` }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <LauraProvider>
              {/* LauraPill now lives INSIDE AppShell as the content-area topbar. */}
              {/* Suspense boundary: pages read useSearchParams(); without an
                  ancestor boundary Next bails the whole route out of prerender. */}
              <Suspense fallback={null}>
                <AppShell>{children}</AppShell>
              </Suspense>
              <LauraChat />
            </LauraProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
