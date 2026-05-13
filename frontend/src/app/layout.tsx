import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LAURA — LOA Agent',
  description: 'LOA Automation & Review Agent — AI to Market × EssilorLuxottica',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-dark">
        {children}
      </body>
    </html>
  )
}
