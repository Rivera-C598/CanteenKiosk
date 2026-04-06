'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Icon } from '@/components/shared/Icon'

function ConfirmedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderNumber = searchParams.get('order') ?? 'A-001'
  const method = searchParams.get('method') ?? 'cash'
  const [countdown, setCountdown] = useState(15)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-8 px-8">
      {/* Success icon */}
      <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center shadow-primary-glow animate-fade-in">
        <Icon name="check" size={64} className="text-on-primary" filled />
      </div>

      {/* Order number */}
      <div className="text-center animate-slide-up">
        <p className="text-on-surface-variant font-medium mb-2">Order Number</p>
        <p className="font-headline font-black text-8xl text-primary tracking-tighter" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {orderNumber}
        </p>
      </div>

      {/* Payment instructions */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl p-5 shadow-ambient text-center animate-slide-up">
        {method === 'cash' ? (
          <>
            <Icon name="payments" size={32} className="text-primary mb-3" filled />
            <p className="font-headline font-bold text-on-surface text-lg mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Please pay at the counter
            </p>
            <p className="text-on-surface-variant text-sm">
              Show this order number to the cashier and pay in cash.
            </p>
          </>
        ) : (
          <>
            <Icon name="qr_code_scanner" size={32} className="text-primary mb-3" filled />
            <p className="font-headline font-bold text-on-surface text-lg mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Payment pending verification
            </p>
            <p className="text-on-surface-variant text-sm">
              Staff will confirm your GCash payment. Watch the queue display for your order number.
            </p>
          </>
        )}
      </div>

      {/* Wait time */}
      <div className="flex items-center gap-2 text-on-surface-variant animate-slide-up">
        <Icon name="schedule" size={20} />
        <p className="font-medium text-sm">Estimated wait: 8–12 minutes</p>
      </div>

      {/* Auto-return countdown */}
      <p className="text-on-surface-variant text-xs mt-4 animate-fade-in">
        Returning to home in {countdown}s…
      </p>
    </div>
  )
}

export default function ConfirmedPage() {
  return (
    <Suspense>
      <ConfirmedContent />
    </Suspense>
  )
}
