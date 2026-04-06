import { CartProvider } from '@/lib/cart-context'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="h-screen w-screen overflow-hidden select-none">
        {children}
      </div>
    </CartProvider>
  )
}
