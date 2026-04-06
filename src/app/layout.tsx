import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HyperBite Canteen Kiosk',
  description: 'University canteen ordering kiosk',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
