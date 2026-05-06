import type { Metadata } from 'next'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { StoreNameProvider } from '@/lib/store-context'
import './globals.css'

interface AppSettings {
  storeName: string
  receiptFooterMessage: string
  autoPrintCustomerReceipts: boolean
  autoPrintKitchenReceipts: boolean
}

async function getAppSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(join(process.cwd(), 'settings.json'), 'utf-8')
    const { storeName, receiptFooterMessage, autoPrintCustomerReceipts, autoPrintKitchenReceipts } = JSON.parse(raw)
    return {
      storeName: typeof storeName === 'string' ? storeName : 'HyperBite',
      receiptFooterMessage: typeof receiptFooterMessage === 'string' ? receiptFooterMessage : 'Thank you for dining at HyperBite!',
      autoPrintCustomerReceipts: typeof autoPrintCustomerReceipts === 'boolean' ? autoPrintCustomerReceipts : false,
      autoPrintKitchenReceipts: typeof autoPrintKitchenReceipts === 'boolean' ? autoPrintKitchenReceipts : false,
    }
  } catch {
    return {
      storeName: 'HyperBite',
      receiptFooterMessage: 'Thank you for dining at HyperBite!',
      autoPrintCustomerReceipts: false,
      autoPrintKitchenReceipts: false,
    }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getAppSettings()
  return {
    title: `${storeName} Canteen Kiosk`,
    description: 'University canteen ordering kiosk',
    authors: [{ name: 'charlieshane57' }],
    creator: 'charlieshane57',
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { storeName, receiptFooterMessage, autoPrintCustomerReceipts, autoPrintKitchenReceipts } = await getAppSettings()
  return (
    <html lang="en">
      <body>
        <StoreNameProvider
          initialName={storeName}
          initialReceiptFooterMessage={receiptFooterMessage}
          initialAutoPrintCustomerReceipts={autoPrintCustomerReceipts}
          initialAutoPrintKitchenReceipts={autoPrintKitchenReceipts}
        >
          {children}
        </StoreNameProvider>
      </body>
    </html>
  )
}
