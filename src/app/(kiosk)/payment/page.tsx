'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { Icon } from '@/components/shared/Icon'

export default function PaymentPage() {
  const router = useRouter()
  const { items, totalAmount, clearCart } = useCart()
  const [selected, setSelected] = useState<'cash' | 'gcash' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
          paymentMethod: selected,
          totalAmount,
        }),
      })

      if (!res.ok) throw new Error('Order failed')
      const order = await res.json()
      clearCart()
      router.push(`/confirmed?order=${order.orderNumber}&method=${selected}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={() => router.push('/cart')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="arrow_back" size={24} />
          <span className="font-body text-sm font-medium">Back</span>
        </button>
        <div className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Payment
        </div>
        <div className="w-20" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        {/* Total */}
        <div className="text-center">
          <p className="text-on-surface-variant font-medium mb-1">Order Total</p>
          <p className="font-headline font-black text-6xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{totalAmount.toFixed(0)}
          </p>
        </div>

        {/* Payment options */}
        <div className="w-full max-w-lg grid grid-cols-2 gap-4">
          {/* Cash */}
          <button
            onClick={() => setSelected('cash')}
            className={`flex flex-col items-center gap-4 p-8 rounded-xl transition-all duration-150 active:scale-95 ${
              selected === 'cash'
                ? 'bg-primary text-on-primary shadow-primary-glow'
                : 'bg-surface-container-lowest text-on-surface shadow-ambient'
            }`}
          >
            <Icon name="payments" size={48} className={selected === 'cash' ? 'text-on-primary' : 'text-primary'} filled={selected === 'cash'} />
            <div className="text-center">
              <p className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cash</p>
              <p className="text-sm opacity-70 mt-1">Pay at the counter</p>
            </div>
          </button>

          {/* GCash */}
          <button
            onClick={() => setSelected('gcash')}
            className={`flex flex-col items-center gap-4 p-8 rounded-xl transition-all duration-150 active:scale-95 ${
              selected === 'gcash'
                ? 'bg-primary text-on-primary shadow-primary-glow'
                : 'bg-surface-container-lowest text-on-surface shadow-ambient'
            }`}
          >
            <Icon name="qr_code_scanner" size={48} className={selected === 'gcash' ? 'text-on-primary' : 'text-primary'} filled={selected === 'gcash'} />
            <div className="text-center">
              <p className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>GCash</p>
              <p className="text-sm opacity-70 mt-1">Scan QR to pay</p>
            </div>
          </button>
        </div>

        {/* GCash instructions */}
        {selected === 'gcash' && (
          <div className="w-full max-w-lg bg-secondary-container rounded-xl p-4 flex items-start gap-3 animate-slide-up">
            <Icon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
            <p className="text-on-secondary-container text-sm font-medium">
              A QR code will be shown after you place your order. Scan with GCash app and send the exact amount. Staff will confirm your payment.
            </p>
          </div>
        )}

        {/* Cash instructions */}
        {selected === 'cash' && (
          <div className="w-full max-w-lg bg-secondary-container rounded-xl p-4 flex items-start gap-3 animate-slide-up">
            <Icon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
            <p className="text-on-secondary-container text-sm font-medium">
              Your order will be placed and you&apos;ll get an order number. Bring it to the counter and pay ₱{totalAmount.toFixed(0)} in cash.
            </p>
          </div>
        )}

        {error && (
          <p className="text-error font-medium text-sm">{error}</p>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full max-w-lg bg-primary text-on-primary rounded-xl px-6 py-5 font-headline font-black text-xl shadow-primary-glow active:scale-[0.98] transition-transform duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? (
            <>
              <Icon name="hourglass_empty" size={24} className="text-on-primary animate-spin" />
              Placing Order…
            </>
          ) : (
            <>
              <Icon name="check_circle" size={24} className="text-on-primary" filled />
              Place Order
            </>
          )}
        </button>
      </div>
    </div>
  )
}
