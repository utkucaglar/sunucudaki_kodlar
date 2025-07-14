import type { Metadata } from 'next'
import './globals.css'
import Image from 'next/image'
import { ThemeProvider } from '@/components/theme-provider'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Akademik Arama',
  description: 'Akademisyenleri ve işbirlikçilerini kolayca bulun',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Header */}
          <header className="w-full bg-background/80 dark:bg-background/90 shadow-md backdrop-blur sticky top-0 z-30">
            <div className="max-w-5xl mx-auto flex items-center justify-center px-4 py-3">
              <span className="text-xl font-bold text-primary tracking-tight">Akademik Arama</span>
            </div>
          </header>
          {/* Main Content */}
          <main className="flex-1 flex flex-col">{children}</main>
          {/* Footer */}
          <footer className="w-full bg-background/70 dark:bg-background/80 text-center text-sm text-muted-foreground py-3 border-t border-border mt-8">
            © {new Date().getFullYear()} Akademik Arama. Tüm hakları saklıdır.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
