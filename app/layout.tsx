import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SupportWidget from '@/components/SupportWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SumblerControl — Mais FPS. Menos Gargalo.',
  description: 'Ferramenta definitiva de otimização para gamers. Análise de gargalo, redução de input lag, benchmark completo e overlay de FPS.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className} style={{ background: '#090F1A', color: '#F1F5FA' }}>
        {children}
        <SupportWidget />
      </body>
    </html>
  )
}

