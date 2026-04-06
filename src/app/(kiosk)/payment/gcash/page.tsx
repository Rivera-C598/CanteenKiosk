'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Icon } from '@/components/shared/Icon'

function GCashContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderNumber = searchParams.get('order') ?? 'A-001'
  const amount = searchParams.get('amount') ?? '0'
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes
  const [gcashAccount, setGcashAccount] = useState<{
    accountName: string
    accountNumber: string
    qrCodeImage: string
  } | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    fetch('/api/gcash/active')
      .then(r => r.json())
      .then(data => setGcashAccount(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (timeLeft <= 0) {
      setExpired(true)
      return
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isUrgent = timeLeft <= 60

  const handlePaid = () => {
    router.push(`/confirmed?order=${orderNumber}&method=gcash`)
  }

  const handleCancel = () => {
    router.push('/')
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="close" size={24} />
          <span className="font-body text-sm font-medium">Cancel</span>
        </button>
        <div className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          GCash Payment
        </div>
        {/* Countdown */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-headline font-black text-lg ${
          isUrgent ? 'bg-error text-on-error' : 'bg-surface-container text-on-surface'
        }`} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <Icon name="timer" size={18} className={isUrgent ? 'text-on-error' : 'text-primary'} />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </header>

      {expired ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <Icon name="timer_off" size={64} className="text-error" />
          <h2 className="font-headline font-black text-2xl text-on-surface text-center" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Payment Time Expired
          </h2>
          <p className="text-on-surface-variant text-center max-w-sm">
            Your order has been cancelled. Please start a new order.
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Start New Order
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 overflow-y-auto py-4">
          {/* Amount */}
          <div className="text-center">
            <p className="text-on-surface-variant font-medium mb-1">Send exactly</p>
            <p className="font-headline font-black text-6xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              ₱{parseFloat(amount).toFixed(0)}
            </p>
            <p className="text-on-surface-variant text-sm mt-1">Order {orderNumber}</p>
          </div>

          {/* QR Code area */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient flex flex-col items-center gap-4 w-full max-w-xs">
            {gcashAccount?.qrCodeImage ? (
              <img
                src={gcashAccount.qrCodeImage}
                alt="GCash QR Code"
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 bg-surface-container rounded-xl flex flex-col items-center justify-center gap-3">
                <Icon name="qr_code" size={64} className="text-on-surface-variant" />
                <p className="text-xs text-on-surface-variant text-center px-4">
                  QR code will be set up by admin
                </p>
              </div>
            )}
            {gcashAccount && (
              <div className="text-center">
                <p className="font-headline font-bold text-on-surface text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {gcashAccount.accountName}
                </p>
                <p className="text-on-surface-variant text-sm">{gcashAccount.accountNumber}</p>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="w-full max-w-sm bg-secondary-container rounded-xl p-4">
            <p className="font-headline font-bold text-on-secondary-container text-sm mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              How to pay:
            </p>
            {[
              { icon: 'smartphone', text: 'Open your GCash app' },
              { icon: 'qr_code_scanner', text: 'Tap "Pay QR" and scan the code above' },
              { icon: 'payments', text: `Enter ₱${parseFloat(amount).toFixed(0)} exactly` },
              { icon: 'send', text: 'Confirm and send payment' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                <div className="w-6 h-6 rounded-full bg-secondary-fixed-dim flex items-center justify-center shrink-0">
                  <span className="font-headline font-black text-xs text-on-secondary-container" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i + 1}</span>
                </div>
                <p className="text-on-secondary-container text-sm">{step.text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handlePaid}
            className="w-full max-w-sm bg-primary text-on-primary rounded-xl px-6 py-5 font-headline font-black text-xl shadow-primary-glow active:scale-[0.98] transition-transform duration-150 flex items-center justify-center gap-3"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            <Icon name="check_circle" size={24} className="text-on-primary" filled />
            I&apos;ve Sent Payment
          </button>
        </div>
      )}
    </div>
  )
}

export default function GCashPaymentPage() {
  return (
    <Suspense>
      <GCashContent />
    </Suspense>
  )
}
