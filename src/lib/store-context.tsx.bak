'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const StoreNameContext = createContext<string>('HyperBite')

interface StoreNameProviderProps {
  initialName: string
  children: ReactNode
}

export function StoreNameProvider({ initialName, children }: StoreNameProviderProps) {
  const [name, setName] = useState(initialName)

  // Sync with API in case of long-running client sessions or client-side navigation
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.storeName) setName(data.storeName)
      })
      .catch(() => {})
  }, [])

  return (
    <StoreNameContext.Provider value={name}>
      {children}
    </StoreNameContext.Provider>
  )
}

export function useStoreName() {
  return useContext(StoreNameContext)
}
