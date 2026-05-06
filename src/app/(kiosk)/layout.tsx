import { CartProvider } from '@/lib/cart-context'
import { LanguageProvider } from '@/lib/language-context'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <div className="min-h-[100dvh] w-screen overflow-hidden select-none">
          {children}
        </div>
      </CartProvider>
    </LanguageProvider>
  )
}
