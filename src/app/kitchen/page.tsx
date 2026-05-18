'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { useAutoPrintKitchenReceipts, useStoreName } from '@/lib/store-context'
import { EditOrderDrawer } from '@/components/kitchen/EditOrderDrawer'

interface OrderItem {
  id: number
  quantity: number
  unitPrice: number
  menuItem: { id: number; name: string }
}
interface Order {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  totalAmount: number
  createdAt: string
  items: OrderItem[]
}

const ACTIVE_STATUSES = 'pending_verification,awaiting_payment,confirmed,preparing,ready'

const STATUS_CONFIG: Record<string, { label: string; color: string; cardBg: string }> = {
  pending_verification: { label: 'Pending Payment Conf.', color: 'text-stone-500', cardBg: 'bg-white border-2 border-stone-200 border-dashed opacity-75' },
  awaiting_payment: { label: 'Awaiting Cash', color: 'text-stone-500', cardBg: 'bg-stone-50 border-2 border-stone-200' },
  confirmed: { label: 'Cashless — Paid', color: 'text-primary', cardBg: 'bg-primary/5 border-2 border-primary/30' },
  preparing: { label: 'Preparing', color: 'text-on-secondary-container', cardBg: 'bg-secondary-container/30 border-2 border-secondary-container' },
  ready: { label: 'Ready for Pickup', color: 'text-on-tertiary-container', cardBg: 'bg-tertiary-container border-2 border-tertiary-container shadow-sm' },
}

const NEXT_ACTION: Record<string, { label: string; icon: string; nextStatus: string; nextPayment?: string }> = {
  pending_verification: { label: 'Confirm GCash', icon: 'check_circle', nextStatus: 'preparing', nextPayment: 'paid' },
  awaiting_payment: { label: 'Confirm Cash', icon: 'payments', nextStatus: 'preparing', nextPayment: 'paid' },
  confirmed: { label: 'Start Preparing', icon: 'cooking', nextStatus: 'preparing' },
  preparing: { label: 'Mark Ready', icon: 'done_all', nextStatus: 'ready' },
  ready: { label: 'Complete Order', icon: 'task_alt', nextStatus: 'completed' },
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

function elapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function elapsedColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins >= 10) return 'text-primary bg-error-container/50 px-2 py-0.5 rounded-md'
  if (mins >= 5) return 'text-secondary font-bold'
  return 'text-stone-400'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function KitchenPage() {
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  useEffect(() => {
    fetch('/api/kitchen/auth').then(r => { if (r.ok) setAuthed(true) })
  }, [])

  const handlePinSubmit = async () => {
    setPinLoading(true)
    setPinError('')
    const res = await fetch('/api/kitchen/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setPinError('Incorrect PIN')
      setPinInput('')
    }
    setPinLoading(false)
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [time, setTime] = useState(new Date())
  const storeName = useStoreName()
  const initialAutoPrintKitchenReceipts = useAutoPrintKitchenReceipts()
  const [acting, setActing] = useState<number | null>(null)
  const prevIdsRef = useRef<Set<number>>(new Set())
  const [completing, setCompleting] = useState<Set<number>>(new Set())
  const [requireAllChecked, setRequireAllChecked] = useState(false)
  const [autoPrintKitchenReceipts, setAutoPrintKitchenReceipts] = useState(initialAutoPrintKitchenReceipts)
  const [checkedItems, setCheckedItems] = useState<Map<number, Set<number>>>(new Map())
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [cashlessTarget, setCashlessTarget] = useState<Order | null>(null)
  const [cashlessStudentId, setCashlessStudentId] = useState('')
  const [cashlessPin, setCashlessPin] = useState('')
  const [cashlessError, setCashlessError] = useState('')
  const [cashlessLoading, setCashlessLoading] = useState(false)

  const toggleItem = (orderId: number, idx: number) => {
    setCheckedItems(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(orderId) ?? [])
      if (set.has(idx)) set.delete(idx); else set.add(idx)
      next.set(orderId, set)
      return next
    })
  }

  const allItemsChecked = (order: Order) =>
    order.items.every((_, i) => checkedItems.get(order.id)?.has(i))

  const printOrder = useCallback((order: Order, isRevised = false) => {
    const time = new Date(order.createdAt).toLocaleString('en-PH', {
      hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric',
    })
    const itemRows = order.items
      .map(item => `
        <div class="slip-item">
          <span class="slip-item-qty">${item.quantity}x</span>
          <span class="slip-item-name">${escapeHtml(item.menuItem.name)}</span>
        </div>
      `)
      .join('')
    const paymentLabel = order.paymentMethod === 'gcash' ? 'GCASH PAYMENT' : order.paymentMethod === 'cashless' ? 'CASHLESS PAYMENT' : 'CASH PAYMENT'

    const slot = document.getElementById('print-slot')
    if (!slot) return
    slot.innerHTML = `
      <div class="print-slip">
        <h1 class="slip-brand">${escapeHtml(storeName)}</h1>
        <p class="slip-campus">CTU - Danao Campus</p>
        <hr class="slip-rule" />
        <p class="slip-order">${order.orderNumber}</p>
        <p class="slip-payment-label">${paymentLabel}</p>
        <hr class="slip-rule" />
        <div class="slip-items">${itemRows}</div>
        <hr class="slip-rule" />
        <p class="slip-total">&#8369;${order.totalAmount.toFixed(2)}</p>
        ${isRevised ? '<p class="slip-revised">[ REVISED ORDER ]</p>' : ''}
        <p class="slip-meta">Date: ${time}</p>
      </div>
    `
    window.print()
    slot.innerHTML = ''
  }, [storeName])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?date=today&status=${ACTIVE_STATUSES}`)
      const data: Order[] = await res.json()
      const newIds = new Set(data.map(o => o.id))
      const previousIds = prevIdsRef.current

      // Detect new orders and beep
      const isFirstLoad = previousIds.size === 0 && data.length > 0
      if (!isFirstLoad) {
        const newOrders = data
          .filter(order => !previousIds.has(order.id))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        if (newOrders.length > 0) {
          playBeep()
          if (autoPrintKitchenReceipts) {
            newOrders.forEach(order => printOrder(order))
          }
        }
      }
      prevIdsRef.current = newIds

      // Sort: oldest first, ready last
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'ready' && b.status !== 'ready') return 1
        if (b.status === 'ready' && a.status !== 'ready') return -1
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
      setOrders(sorted)
    } catch {}
  }, [autoPrintKitchenReceipts, printOrder])

  useEffect(() => {
    load()
    const poll = setInterval(load, 3000)
    const tick = setInterval(() => setTime(new Date()), 10000)
    const cleanup = setInterval(() => {
      fetch('/api/orders/cleanup', { method: 'POST' })
        .then(r => r.json())
        .then(d => { if (d.cancelled > 0) load() })
        .catch(() => {})
    }, 30000)
    return () => { clearInterval(poll); clearInterval(tick); clearInterval(cleanup) }
  }, [load])

  useEffect(() => {
    const fetchSettings = () => {
      fetch('/api/settings')
        .then(r => r.json())
        .then(s => {
          setRequireAllChecked(s.requireAllItemsChecked ?? false)
          setAutoPrintKitchenReceipts(s.autoPrintKitchenReceipts ?? false)
        })
        .catch(() => {})
    }
    fetchSettings()
    const poll = setInterval(fetchSettings, 30000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    setAutoPrintKitchenReceipts(initialAutoPrintKitchenReceipts)
  }, [initialAutoPrintKitchenReceipts])

  const advance = async (order: Order) => {
    const action = NEXT_ACTION[order.status]
    if (!action) return
    setActing(order.id)

    if (action.nextStatus === 'completed') {
      setCompleting(prev => new Set(prev).add(order.id))
      setCheckedItems(prev => { const next = new Map(prev); next.delete(order.id); return next })
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== order.id))
        setCompleting(prev => { const s = new Set(prev); s.delete(order.id); return s })
      }, 1000)
    }

    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: action.nextStatus,
        ...(action.nextPayment ? { paymentStatus: action.nextPayment } : {}),
      }),
    })
    setActing(null)
    if (action.nextStatus !== 'completed') load()
  }

  const doCancel = async (order: Order, reason: string) => {
    setCancelTarget(null)
    setCompleting(prev => new Set(prev).add(order.id))
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setCompleting(prev => { const s = new Set(prev); s.delete(order.id); return s })
      setCheckedItems(prev => { const next = new Map(prev); next.delete(order.id); return next })
    }, 600)
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancelReason: reason }),
    })
  }

  const doConfirmCashless = async () => {
    if (!cashlessTarget || cashlessPin.length < 4) return
    setCashlessLoading(true)
    setCashlessError('')
    const res = await fetch('/api/cashless/pay-by-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIdNumber: cashlessStudentId, pin: cashlessPin, orderId: cashlessTarget.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setCashlessError(data.error ?? 'Payment failed')
      setCashlessLoading(false)
      return
    }
    setCashlessTarget(null)
    setCashlessStudentId('')
    setCashlessPin('')
    setCashlessError('')
    setCashlessLoading(false)
    load()
  }

  const handleEditSaved = (updatedOrder: { id: number; orderNumber: string; totalAmount: number; items: OrderItem[] }) => {
    const existing = orders.find(o => o.id === updatedOrder.id)
    if (!existing) { setEditingOrder(null); return }
    const full: Order = { ...existing, totalAmount: updatedOrder.totalAmount, items: updatedOrder.items }
    setOrders(prev => prev.map(o => o.id !== full.id ? o : full))
    // Reset checked state — items changed, staff must re-verify each one
    setCheckedItems(prev => { const next = new Map(prev); next.delete(full.id); return next })
    setEditingOrder(null)
    printOrder(full, true)
  }

  if (!authed) return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-4">
      <div className="bg-surface rounded-3xl p-8 w-full max-w-xs shadow-2xl flex flex-col items-center gap-6">
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-primary-glow">
          <Icon name="kitchen" size={28} className="text-on-primary" />
        </div>
        <div className="text-center">
          <h1 className="font-headline font-black text-2xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Kitchen Access
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Enter staff PIN to continue</p>
        </div>

        <div className="flex gap-3 justify-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pinInput.length ? 'bg-primary' : 'bg-surface-container'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 w-full">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              onClick={() => {
                if (d === '⌫') setPinInput(p => p.slice(0, -1))
                else if (d && pinInput.length < 4) setPinInput(p => p + d)
              }}
              disabled={pinLoading || !d}
              className={`py-4 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                d === '⌫' ? 'bg-surface-container text-on-surface' :
                d ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'invisible'
              } disabled:opacity-40`}
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {d}
            </button>
          ))}
        </div>

        {pinError && <p className="text-error text-sm font-medium">{pinError}</p>}

        <button
          onClick={handlePinSubmit}
          disabled={pinInput.length < 4 || pinLoading}
          className="w-full bg-primary text-on-primary rounded-xl py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] disabled:opacity-40 transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {pinLoading ? 'Verifying…' : 'Enter'}
        </button>
      </div>
    </div>
  )

  return (
    <>
    <div className="kitchen-screen min-h-[100dvh] bg-surface-container-low flex flex-col font-body">
      {/* Header */}
      <header className="bg-surface-container-lowest px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b shadow-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <Icon name="kitchen" size={24} className="text-on-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline font-black text-on-surface text-xl sm:text-2xl tracking-tight truncate">Kitchen Display</h1>
            <p className="text-stone-500 text-xs sm:text-sm font-medium tracking-wider uppercase truncate">{storeName} Operator</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6">
          <div className="flex items-center gap-2 bg-secondary-container/20 border border-secondary-container/50 rounded-full px-4 sm:px-5 py-2">
            <Icon name="receipt_long" size={18} className="text-secondary" />
            <span className="font-headline font-bold text-secondary text-sm">
              <span className="text-lg mr-1">{orders.length}</span> Active Tasks
            </span>
          </div>
          <p className="font-headline font-black text-on-surface text-2xl sm:text-3xl shrink-0">
            {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Grid */}
      <main className="p-3 sm:p-5 lg:p-6 flex-1 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-5 py-20">
            <div className="w-32 h-32 bg-surface-container-lowest rounded-full flex items-center justify-center shadow-inner">
              <Icon name="done_all" size={64} className="text-tertiary" />
            </div>
            <p className="font-headline font-black text-3xl text-stone-600 tracking-tight">All clear!</p>
            <p className="text-lg font-medium">No active orders in the queue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 content-start">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.preparing
              const action = NEXT_ACTION[order.status]
              const isCompleting = completing.has(order.id)

              return (
                <div
                  key={order.id}
                  className={`${cfg.cardBg} rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 transition-all duration-500 overflow-hidden relative ${isCompleting ? 'opacity-0 scale-90 translate-y-4 shadow-none' : 'opacity-100 scale-100'}`}
                >
                  {order.status === 'ready' && <div className="absolute top-0 left-0 w-full h-1.5 bg-tertiary" />}
                  {order.status === 'preparing' && <div className="absolute top-0 left-0 w-full h-1.5 bg-secondary" />}
                  
                  {/* Order number + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-headline font-black text-3xl sm:text-4xl text-on-surface tracking-tight mb-0.5 truncate">
                        {order.orderNumber}
                      </p>
                      <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {order.paymentMethod === 'gcash' ? (
                       <div className="bg-[#0000ff]/10 text-[#0000ff] px-2 py-1 rounded-md flex items-center justify-center">
                         <Icon name="qr_code" size={24} />
                       </div>
                    ) : order.paymentMethod === 'cashless' ? (
                      <div className="bg-primary/10 text-primary px-2 py-1 rounded-md flex items-center justify-center">
                        <Icon name="account_balance_wallet" size={24} />
                      </div>
                    ) : (
                      <div className="bg-stone-200 text-stone-500 px-2 py-1 rounded-md flex items-center justify-center">
                         <Icon name="payments" size={24} />
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="flex-1 space-y-2.5 py-3 sm:py-4 border-y border-black/5">
                    {order.items.map((item, i) => {
                      const isChecked = checkedItems.get(order.id)?.has(i) ?? false
                      return (
                        <button
                          key={i}
                          onClick={() => toggleItem(order.id, i)}
                          className="flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity min-h-10"
                        >
                          <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black shadow-sm transition-colors ${isChecked ? 'bg-tertiary text-on-tertiary' : 'bg-on-surface text-surface'}`}>
                            {isChecked ? <Icon name="check" size={16} /> : item.quantity}
                          </span>
                          <span className={`font-bold text-base sm:text-lg leading-tight transition-all break-words ${isChecked ? 'line-through text-stone-400' : order.status === 'ready' ? 'line-through text-stone-400' : 'text-on-surface'}`}>
                            {item.menuItem.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Actions Area */}
                  <div className="flex flex-col gap-3 pt-2">
                    {/* Elapsed */}
                    <div className="flex items-center gap-1.5">
                      <Icon name="schedule" size={16} className={elapsedColor(order.createdAt).split(' ')[0]} />
                      <span className={`text-sm font-bold ${elapsedColor(order.createdAt)}`}>{elapsed(order.createdAt)}</span>
                    </div>

                    {/* Button */}
                    {action && (
                      <>
                        <button
                          onClick={() => {
                            if (order.status === 'pending_verification' && order.paymentMethod === 'cashless') {
                              setCashlessTarget(order)
                              setCashlessPin('')
                              setCashlessStudentId('')
                              setCashlessError('')
                            } else {
                              advance(order)
                            }
                          }}
                          disabled={acting === order.id || (requireAllChecked && order.status === 'preparing' && !allItemsChecked(order))}
                          className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-headline font-bold text-sm sm:text-base active:scale-95 transition-all disabled:opacity-50 ${order.status === 'ready' ? 'bg-tertiary text-on-tertiary shadow-lg shadow-tertiary/30' : order.status === 'preparing' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/30' : order.status === 'confirmed' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' : 'bg-surface-container-highest text-on-surface hover:bg-stone-300'}`}
                        >
                          <Icon name={order.status === 'pending_verification' && order.paymentMethod === 'cashless' ? 'account_balance_wallet' : action.icon} size={22} />
                          {acting === order.id ? 'Loading…' : order.status === 'pending_verification' && order.paymentMethod === 'cashless' ? 'Confirm Cashless' : `${action.label} — ₱${order.totalAmount.toFixed(2)}`}
                        </button>
                        {requireAllChecked && order.status === 'preparing' && !allItemsChecked(order) && (
                          <p className="text-xs text-center text-stone-400 font-medium">
                            Check all items first
                          </p>
                        )}
                        <button
                          onClick={() => printOrder(order)}
                          disabled={order.status === 'ready'}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-headline font-bold text-xs text-stone-500 bg-surface-container hover:bg-stone-200 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="print" size={16} />
                          Print Slip
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingOrder(order)}
                            disabled={order.status === 'ready' || order.paymentStatus === 'paid'}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-headline font-bold text-xs text-secondary bg-secondary-container/30 hover:bg-secondary-container/50 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Icon name="edit" size={15} />
                            Edit
                          </button>
                          <button
                            onClick={() => setCancelTarget(order)}
                            disabled={order.status === 'ready'}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-headline font-bold text-xs text-error bg-error-container/20 hover:bg-error-container/40 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Icon name="cancel" size={15} />
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      {/* Cancel reason picker */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Icon name="cancel" size={24} className="text-error" />
            </div>
            <h3 className="font-headline font-black text-2xl text-center text-on-surface mb-1 tracking-tight">
              Cancel Order?
            </h3>
            <p className="text-center text-on-surface-variant text-sm font-medium mb-4">
              Order <span className="font-black text-on-surface">{cancelTarget.orderNumber}</span> — why are you cancelling?
            </p>

            {/* Refund notice for paid orders */}
            {cancelTarget.paymentStatus === 'paid' && (
              <div className={`mb-5 p-3 rounded-xl text-sm font-medium text-center ${
                cancelTarget.paymentMethod === 'cashless'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-warning-container text-on-warning-container'
              }`}>
                {cancelTarget.paymentMethod === 'cashless'
                  ? `₱${cancelTarget.totalAmount.toFixed(2)} will be automatically refunded to the student's cashless balance.`
                  : 'GCash payment — manual refund required after cancellation.'}
              </div>
            )}

            <div className="flex flex-col gap-2 mb-3">
              {[
                { key: 'customer_request', label: 'Customer Request' },
                { key: 'out_of_stock', label: 'Out of Stock' },
                { key: 'duplicate', label: 'Duplicate Order' },
                { key: 'abandoned', label: 'Abandoned / No Payment' },
              ].map(reason => (
                <button
                  key={reason.key}
                  onClick={() => doCancel(cancelTarget, reason.key)}
                  className="w-full py-3.5 rounded-xl font-headline font-bold text-sm bg-error/10 text-error hover:bg-error hover:text-white active:scale-95 transition-all"
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCancelTarget(null)}
              className="w-full py-3.5 rounded-xl font-headline font-bold text-sm bg-surface-container-low hover:bg-surface-container active:scale-95 transition-all text-on-surface"
            >
              Oops, go back
            </button>
          </div>
        </div>
      )}

      {/* Edit order drawer */}
      <EditOrderDrawer
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSaved={handleEditSaved}
      />

      {/* Cashless manual PIN modal */}
      {cashlessTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col gap-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 mx-auto">
                <Icon name="account_balance_wallet" size={24} className="text-primary" />
              </div>
              <h2 className="font-headline font-black text-on-surface text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Confirm Cashless
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Order {cashlessTarget.orderNumber} · ₱{cashlessTarget.totalAmount.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wide">Student ID Number</label>
                <input
                  value={cashlessStudentId}
                  onChange={e => setCashlessStudentId(e.target.value)}
                  placeholder="e.g. 2021234"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary font-mono tracking-widest text-center"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wide">Student PIN</label>
                {/* PIN numpad */}
                <div className="flex gap-3 justify-center mb-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < cashlessPin.length ? 'bg-primary' : 'bg-surface-container'}`} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (d === '⌫') setCashlessPin(p => p.slice(0, -1))
                        else if (d && cashlessPin.length < 4) setCashlessPin(p => p + d)
                      }}
                      disabled={cashlessLoading || !d}
                      className={`py-3 rounded-xl font-black text-xl transition-all active:scale-95 ${
                        d === '⌫' ? 'bg-surface-container text-on-surface' :
                        d ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'invisible'
                      } disabled:opacity-40`}
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {cashlessError && (
              <p className="text-error text-sm text-center font-medium">{cashlessError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setCashlessTarget(null); setCashlessPin(''); setCashlessStudentId(''); setCashlessError('') }}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={doConfirmCashless}
                disabled={cashlessLoading || cashlessPin.length < 4 || !cashlessStudentId}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-primary-glow active:scale-95 disabled:opacity-40"
              >
                {cashlessLoading ? 'Verifying…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <div id="print-slot" />
    </>
  )
}
