import type { Metadata } from 'next'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { StoreNameProvider } from '@/lib/store-context'
import './globals.css'

async function getStoreName() {
  try {
    const raw = await readFile(join(process.cwd(), 'settings.json'), 'utf-8')
    const { storeName } = JSON.parse(raw)
    return storeName || 'HyperBite'
  } catch {
    return 'HyperBite'
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const storeName = await getStoreName()
  return {
    title: `${storeName} Canteen Kiosk`,
    description: 'University canteen ordering kiosk',
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const storeName = await getStoreName()
  return (
    <html lang="en">
      <body>
        <StoreNameProvider initialName={storeName}>
          {children}
        </StoreNameProvider>
      </body>
    </html>
  )
}
