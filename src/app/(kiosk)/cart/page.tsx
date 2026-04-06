'use client'

import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { Icon } from '@/components/shared/Icon'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, totalItems, totalAmount } = useCart()

  if (items.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-6">
        <Icon name="shopping_cart" className="text-outline" size={64} />
        <p className="font-headline font-bold text-on-surface-variant text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Your cart is empty
        </p>
        <button
          onClick={() => router.push('/menu')}
          className="btn-primary"
        >
          Browse Menu
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={() => router.push('/menu')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="arrow_back" size={24} />
          <span className="font-body text-sm font-medium">Back to Menu</span>
        </button>
        <div className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Your Order
        </div>
        <div className="w-24" />
      </header>

      {/* Order items */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-4 shadow-ambient">
            {/* Placeholder or image */}
            <div className="w-16 h-16 bg-surface-container rounded-xl flex items-center justify-center shrink-0">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Icon name="restaurant" className="text-outline" size={28} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-headline font-bold text-on-surface text-sm truncate" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {item.name}
              </h3>
              <p className="font-headline font-black text-primary mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                ₱{(item.price * item.quantity).toFixed(0)}
              </p>
            </div>
            {/* Quantity controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform"
              >
                <Icon name={item.quantity === 1 ? 'delete' : 'remove'} size={16} className="text-on-surface-variant" />
              </button>
              <span className="font-headline font-black text-on-surface w-6 text-center" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform"
              >
                <Icon name="add" size={16} className="text-on-primary" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div className="shrink-0 bg-surface-container-low px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-body text-on-surface-variant font-medium">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span className="font-body text-on-surface-variant text-sm">Total</span>
            <span className="font-headline font-black text-2xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>₱{totalAmount.toFixed(0)}</span>
          </div>
        </div>
        <button
          onClick={() => router.push('/payment')}
          className="w-full bg-primary text-on-primary rounded-xl px-6 py-4 font-headline font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform duration-150 flex items-center justify-center gap-3"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="payment" size={24} className="text-on-primary" />
          Proceed to Payment
        </button>
      </div>
    </div>
  )
}
