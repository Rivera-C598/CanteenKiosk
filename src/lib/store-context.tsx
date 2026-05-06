'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface StoreSettings {
  storeName: string
  receiptFooterMessage: string
  autoPrintCustomerReceipts: boolean
  autoPrintKitchenReceipts: boolean
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'HyperBite',
  receiptFooterMessage: 'Thank you for dining at HyperBite!',
  autoPrintCustomerReceipts: false,
  autoPrintKitchenReceipts: false,
}

const StoreSettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS)

interface StoreNameProviderProps {
  initialName: string
  initialReceiptFooterMessage: string
  initialAutoPrintCustomerReceipts: boolean
  initialAutoPrintKitchenReceipts: boolean
  children: ReactNode
}

export function StoreNameProvider({
  initialName,
  initialReceiptFooterMessage,
  initialAutoPrintCustomerReceipts,
  initialAutoPrintKitchenReceipts,
  children,
}: StoreNameProviderProps) {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: initialName,
    receiptFooterMessage: initialReceiptFooterMessage,
    autoPrintCustomerReceipts: initialAutoPrintCustomerReceipts,
    autoPrintKitchenReceipts: initialAutoPrintKitchenReceipts,
  })

  // Sync with API in case of long-running client sessions or client-side navigation
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(prev => ({
          storeName: typeof data.storeName === 'string' ? data.storeName : prev.storeName,
          receiptFooterMessage: typeof data.receiptFooterMessage === 'string' ? data.receiptFooterMessage : prev.receiptFooterMessage,
          autoPrintCustomerReceipts: typeof data.autoPrintCustomerReceipts === 'boolean' ? data.autoPrintCustomerReceipts : prev.autoPrintCustomerReceipts,
          autoPrintKitchenReceipts: typeof data.autoPrintKitchenReceipts === 'boolean' ? data.autoPrintKitchenReceipts : prev.autoPrintKitchenReceipts,
        }))
      })
      .catch(() => {})
  }, [])

  return (
    <StoreSettingsContext.Provider value={settings}>
      {children}
    </StoreSettingsContext.Provider>
  )
}

export function useStoreName() {
  return useContext(StoreSettingsContext).storeName
}

export function useReceiptFooterMessage() {
  return useContext(StoreSettingsContext).receiptFooterMessage
}

export function useAutoPrintCustomerReceipts() {
  return useContext(StoreSettingsContext).autoPrintCustomerReceipts
}

export function useAutoPrintKitchenReceipts() {
  return useContext(StoreSettingsContext).autoPrintKitchenReceipts
}
