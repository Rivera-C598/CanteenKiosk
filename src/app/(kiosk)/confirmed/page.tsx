'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Icon } from '@/components/shared/Icon'
import { useLanguage } from '@/lib/language-context'
import { useStoreName } from '@/lib/store-context'

function ConfirmedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useLanguage()
  const storeName = useStoreName()
  const orderNumber = searchParams.get('order') ?? 'A-001'
  const method = searchParams.get('method') ?? 'cash'
  const [countdown, setCountdown] = useState(15)
  const [waitTime, setWaitTime] = useState('Calculating...')

  useEffect(() => {
    fetch('/api/orders/metrics').then(r => r.json()).then(data => {
      const active = data.activeOrders ?? 0
      const mins = Math.min(45, 3 + (active * 2))
      setWaitTime(`Estimated wait: ${mins} minutes`)
    }).catch(() => setWaitTime('Estimated wait: 10 minutes'))
  }, [])

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
        <p className="text-on-surface-variant font-medium mb-2">{t('confirmed.order_no')}</p>
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
              {t('confirmed.cash_title')}
            </p>
            <p className="text-on-surface-variant text-sm">
              {t('confirmed.cash_desc')}
            </p>
          </>
        ) : (
          <>
            <Icon name="qr_code_scanner" size={32} className="text-primary mb-3" filled />
            <p className="font-headline font-bold text-on-surface text-lg mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {t('confirmed.gcash_title')}
            </p>
            <p className="text-on-surface-variant text-sm">
              {t('confirmed.gcash_desc')}
            </p>
          </>
        )}
      </div>

      {/* Wait time */}
      <div className="flex items-center gap-2 text-on-surface-variant animate-slide-up">
        <Icon name="schedule" size={20} />
        <p className="font-medium text-sm">{waitTime}</p>
      </div>

      {/* Manual Action: Print Receipt / Student proof */}
      <button onClick={() => window.print()} className="mt-4 flex items-center justify-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-full font-headline font-black text-lg shadow-primary-glow active:scale-95 transition-all">
        <Icon name="print" size={24} />
        Print Copy
      </button>

      {/* Auto-return countdown */}
      <p className="text-on-surface-variant text-xs mt-2 animate-fade-in">
        {t('confirmed.returning')} {countdown}s…
      </p>

      {/* Hidden Print Area */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>
      <div className="print-area hidden invisible bg-white text-black w-full max-w-sm p-4 text-center font-mono text-sm leading-tight">
         <h1 className="text-2xl font-black italic mb-2 mt-4">{storeName}</h1>
         <p className="mb-4 text-xs font-bold">CTU - Danao Campus</p>
         <div className="border-t border-black border-dashed my-4"></div>
         <p className="text-6xl font-black mb-2">{orderNumber}</p>
         <p className="text-[10px] uppercase font-bold tracking-widest">{method === 'cash' ? 'CASH PAYMENT' : 'GCASH (Pending)'}</p>
         <div className="border-t border-black border-dashed my-4"></div>
         <p className="text-sm font-bold mb-6 tracking-wide">Please present this ticket<br/>to claim your order.</p>
         <p className="text-[10px] mt-8 opacity-50 mb-4 tracking-widest">Date: {new Date().toLocaleString('en-PH')}</p>
      </div>
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
