'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface StatusResult {
  orderNumber: string
  status: string
  cancelReason: string
  refundStatus: string
  items: { name: string; quantity: number }[]
  createdAt: string
}

const STATUS_DISPLAY: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending_verification: { label: 'Awaiting GCash Confirmation', icon: 'qr_code_scanner', color: 'text-stone-600', bg: 'bg-stone-100' },
  awaiting_payment: { label: 'Awaiting Cash Payment', icon: 'payments', color: 'text-stone-600', bg: 'bg-stone-100' },
  preparing: { label: 'Being Prepared', icon: 'soup_kitchen', color: 'text-secondary', bg: 'bg-secondary-container' },
  ready: { label: 'Ready for Pickup!', icon: 'done_all', color: 'text-tertiary', bg: 'bg-tertiary-container' },
  completed: { label: 'Order Completed', icon: 'task_alt', color: 'text-stone-500', bg: 'bg-stone-100' },
  cancelled: { label: 'Order Cancelled', icon: 'cancel', color: 'text-error', bg: 'bg-error-container' },
}

export default function StatusPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<StatusResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    const q = input.trim().toUpperCase()
    if (!q) return
    setLoading(true)
    setResult(null)
    setNotFound(false)
    try {
      const res = await fetch(`/api/orders/status?order=${encodeURIComponent(q)}`)
      if (res.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setResult(await res.json())
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }

  const cfg = result ? (STATUS_DISPLAY[result.status] ?? STATUS_DISPLAY.preparing) : null

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <h1 className="font-headline font-black text-xl text-on-surface">Check Order Status</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* Input */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <p className="text-on-surface-variant font-medium text-center text-sm">
            Enter your order number from your receipt
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="A-001"
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-5 py-4 text-2xl font-headline font-black text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              autoFocus
            />
            <button
              onClick={lookup}
              disabled={loading || !input.trim()}
              className="bg-primary text-on-primary px-6 py-4 rounded-xl font-headline font-bold text-lg shadow-primary-glow active:scale-95 transition-all disabled:opacity-40"
            >
              {loading
                ? <Icon name="hourglass_empty" size={24} className="animate-spin" />
                : <Icon name="search" size={24} />
              }
            </button>
          </div>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 text-center shadow-ambient">
            <Icon name="search_off" size={40} className="text-stone-400 mb-2" />
            <p className="font-headline font-bold text-on-surface mb-1">Order Not Found</p>
            <p className="text-sm text-on-surface-variant">Check your receipt and try again.</p>
          </div>
        )}

        {/* Result card */}
        {result && cfg && (
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
            {/* Status header */}
            <div className={`${cfg.bg} px-6 py-5 flex items-center gap-4`}>
              <Icon name={cfg.icon} size={32} className={cfg.color} />
              <div>
                <p className="font-headline font-black text-3xl text-on-surface tracking-tight">{result.orderNumber}</p>
                <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4 space-y-2">
              {result.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-xs font-black text-on-surface shrink-0">
                    {item.quantity}
                  </span>
                  <span className="text-on-surface font-medium">{item.name}</span>
                </div>
              ))}
            </div>

            {/* Cancel reason */}
            {result.cancelReason && (
              <div className="px-6 pb-4">
                <p className="text-sm text-on-surface-variant">{result.cancelReason}</p>
              </div>
            )}

            {/* GCash refund notice */}
            {result.status === 'cancelled' && result.refundStatus === 'pending' && (
              <div className="mx-6 mb-5 bg-error-container/30 rounded-xl p-3 flex items-start gap-2">
                <Icon name="info" size={18} className="text-error shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-error">
                  GCash refund pending — please see the cashier.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
