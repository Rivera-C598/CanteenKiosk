'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { Icon } from '@/components/shared/Icon'
import { useLanguage } from '@/lib/language-context'

export default function PaymentPage() {
  const router = useRouter()
  const { items, totalAmount, clearCart } = useCart()
  const { t } = useLanguage()
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
      if (selected === 'gcash') {
        router.push(`/payment/gcash?order=${order.orderNumber}&amount=${totalAmount}`)
      } else {
        router.push(`/confirmed?order=${order.orderNumber}&method=${selected}`)
      }
    } catch {
      setError(t('payment.error'))
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
          <span className="font-body text-sm font-medium">{t('payment.back')}</span>
        </button>
        <div className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('payment.title')}
        </div>
        <div className="w-20" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        {/* Total */}
        <div className="text-center">
          <p className="text-on-surface-variant font-medium mb-1">{t('payment.total')}</p>
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
              <p className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{t('payment.cash')}</p>
              <p className="text-sm opacity-70 mt-1">{t('payment.cash_desc')}</p>
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
              <p className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{t('payment.gcash')}</p>
              <p className="text-sm opacity-70 mt-1">{t('payment.gcash_desc')}</p>
            </div>
          </button>
        </div>

        {selected === 'gcash' && (
          <div className="w-full max-w-lg bg-secondary-container rounded-xl p-4 flex items-start gap-3 animate-slide-up">
            <Icon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
            <p className="text-on-secondary-container text-sm font-medium">
              {t('payment.gcash_info')}
            </p>
          </div>
        )}

        {selected === 'cash' && (
          <div className="w-full max-w-lg bg-secondary-container rounded-xl p-4 flex items-start gap-3 animate-slide-up">
            <Icon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
            <p className="text-on-secondary-container text-sm font-medium">
              {t('payment.cash_info')}
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
              {t('payment.loading')}
            </>
          ) : (
            <>
              <Icon name="check_circle" size={24} className="text-on-primary" filled />
              {t('payment.button')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
