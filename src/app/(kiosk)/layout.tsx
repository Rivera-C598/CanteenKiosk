import { CartProvider } from '@/lib/cart-context'
import { LanguageProvider } from '@/lib/language-context'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <div className="h-screen w-screen overflow-hidden select-none">
          {children}
        </div>
      </CartProvider>
    </LanguageProvider>
  )
}
