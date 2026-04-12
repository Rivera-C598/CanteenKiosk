'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface OrderItem { quantity: number; menuItem: { name: string } }
interface Order {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  totalAmount: number
  createdAt: string
  cancelReason: string
  refundStatus: string
  items: OrderItem[]
}

interface OrderLog {
  id: number
  orderId: number
  action: string
  snapshot: string
  createdAt: string
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending_verification', label: 'Pending GCash' },
  { key: 'awaiting_payment', label: 'Awaiting Cash' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const DATE_OPTS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
]

const STATUS_BADGE: Record<string, string> = {
  pending_verification: 'bg-secondary-container/30 text-on-secondary-container',
  awaiting_payment: 'bg-surface-container-highest/50 text-on-surface-variant',
  preparing: 'bg-tertiary-container/30 text-base font-bold text-on-tertiary-container',
  ready: 'bg-tertiary text-on-tertiary shadow-sm',
  completed: 'bg-surface-container text-stone-500',
  cancelled: 'bg-error-container/30 text-error',
}

const STATUS_LABEL: Record<string, string> = {
  pending_verification: 'Pending GCash',
  awaiting_payment: 'Awaiting Cash',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const NEXT_ACTION: Record<string, { label: string; nextStatus: string; nextPayment?: string }> = {
  pending_verification: { label: 'Confirm GCash', nextStatus: 'preparing', nextPayment: 'paid' },
  awaiting_payment: { label: 'Confirm Cash', nextStatus: 'preparing', nextPayment: 'paid' },
  preparing: { label: 'Mark Ready', nextStatus: 'ready' },
  ready: { label: 'Complete', nextStatus: 'completed' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')
  const [acting, setActing] = useState<number | null>(null)
  const [logsModal, setLogsModal] = useState<{ orderNumber: string; logs: OrderLog[] } | null>(null)

  const load = () => {
    const params = new URLSearchParams({ date: dateFilter })
    if (statusTab !== 'all') params.set('status', statusTab)
    fetch(`/api/orders?${params}`)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { setLoading(true); load() }, [statusTab, dateFilter])

  const advanceOrder = async (order: Order) => {
    const action = NEXT_ACTION[order.status]
    if (!action) return
    setActing(order.id)
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: action.nextStatus,
        ...(action.nextPayment ? { paymentStatus: action.nextPayment } : {}),
      }),
    })
    setActing(null)
    load()
  }

  const cancelOrder = async (id: number) => {
    if (!confirm('Cancel this order?')) return
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    load()
  }

  const deleteOrder = async (id: number, orderNumber: string) => {
    if (!confirm(`Permanently delete order ${orderNumber} and all its records? This cannot be undone.`)) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    load()
  }

  const markRefunded = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refundStatus: 'completed' }),
    })
    load()
  }

  const viewLogs = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/logs?orderId=${order.id}`)
      const logs = await res.json()
      setLogsModal({ orderNumber: order.orderNumber, logs: Array.isArray(logs) ? logs : [] })
    } catch {
      setLogsModal({ orderNumber: order.orderNumber, logs: [] })
    }
  }

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">Orders</h2>
          <p className="text-stone-500 font-body mt-2">View and manage customer orders and payment confirmations.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap p-1.5 bg-surface-container-low rounded-xl w-fit">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={`px-5 py-2 rounded-lg font-headline font-bold text-sm transition-all ${statusTab === t.key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-stone-500 hover:text-on-surface hover:bg-surface-container/50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Date filter */}
        <div className="flex gap-1.5 flex-wrap bg-surface-container-low/50 p-1.5 rounded-xl border border-surface-container">
          {DATE_OPTS.map(d => (
            <button
              key={d.key}
              onClick={() => setDateFilter(d.key)}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${dateFilter === d.key ? 'bg-stone-200 text-on-surface shadow-sm' : 'text-stone-500 hover:text-on-surface hover:bg-stone-100'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending refunds banner */}
      {orders.some(o => o.refundStatus === 'pending') && (
        <div className="mb-6 bg-error-container/30 border border-error/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <Icon name="warning" size={20} className="text-error shrink-0" />
          <p className="text-sm font-bold text-error flex-1">
            {orders.filter(o => o.refundStatus === 'pending').length} GCash refund{orders.filter(o => o.refundStatus === 'pending').length > 1 ? 's' : ''} pending — students are waiting for their money back.
          </p>
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest border border-dashed border-outline-variant/30 rounded-2xl gap-4">
          <div className="w-16 h-16 bg-surface-container-low rounded-2xl flex items-center justify-center">
            <Icon name="receipt_long" size={32} className="text-stone-400" />
          </div>
          <p className="font-headline font-bold text-stone-500 text-lg">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map(order => {
            const action = NEXT_ACTION[order.status]
            return (
              <div key={order.id} className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:shadow-ambient transition-shadow group">
                {/* Payment icon & Status line */}
                <div className="flex-1 flex items-start gap-4 min-w-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${order.paymentMethod === 'gcash' ? 'bg-tertiary-container/20 text-tertiary' : 'bg-secondary-container/20 text-secondary'}`}>
                    <Icon name={order.paymentMethod === 'gcash' ? 'qr_code' : 'payments'} size={28} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-headline font-extrabold text-lg text-on-surface tracking-tight">
                        {order.orderNumber}
                      </p>
                      <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full tracking-wider ${STATUS_BADGE[order.status] ?? 'bg-surface-container text-stone-500'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      {order.refundStatus === 'pending' && (
                        <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-error/10 text-error tracking-wider">
                          Refund Pending
                        </span>
                      )}
                      {order.refundStatus === 'completed' && (
                        <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-surface-container text-stone-400 tracking-wider">
                          Refunded
                        </span>
                      )}
                      <span className="text-xs font-medium text-stone-400 flex items-center gap-1">
                        <Icon name="schedule" size={14} />
                        {timeAgo(order.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {order.items.map(i => `${i.quantity}× ${i.menuItem.name}`).join('  •  ')}
                    </p>
                  </div>
                </div>

                {/* Total and Actions */}
                <div className="flex items-center sm:justify-end gap-6 sm:w-1/3 shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-surface-container">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-stone-400 font-bold uppercase mb-0.5 tracking-wider">Total</p>
                    <p className="font-headline font-black text-xl text-primary">
                      ₱{order.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-wrap justify-end">
                    {order.refundStatus === 'pending' && (
                      <button
                        onClick={() => markRefunded(order.id)}
                        className="px-4 py-2 text-xs font-bold bg-tertiary text-on-tertiary rounded-xl active:scale-95 transition-transform shadow-sm"
                      >
                        Mark Refunded
                      </button>
                    )}
                    {action && (
                      <button
                        onClick={() => advanceOrder(order)}
                        disabled={acting === order.id}
                        className="bg-primary text-on-primary text-sm font-headline font-bold px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50 min-w-[120px] text-center"
                      >
                        {acting === order.id ? 'Updating…' : action.label}
                      </button>
                    )}
                    {!['completed', 'cancelled'].includes(order.status) && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        title="Cancel Order"
                        className="p-2.5 text-stone-400 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                      >
                        <Icon name="cancel" size={20} />
                      </button>
                    )}
                    {['completed', 'cancelled'].includes(order.status) && (
                      <button
                        onClick={() => deleteOrder(order.id, order.orderNumber)}
                        title="Permanently Delete"
                        className="p-2.5 text-stone-400 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                      >
                        <Icon name="delete_forever" size={20} />
                      </button>
                    )}
                    <button
                      onClick={() => viewLogs(order)}
                      title="View Order Logs"
                      className="p-2.5 text-stone-400 hover:text-secondary hover:bg-secondary/10 rounded-xl transition-all"
                    >
                      <Icon name="history" size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {logsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h3 className="font-headline font-black text-2xl text-on-surface tracking-tight">Order Logs</h3>
                <p className="text-stone-500 font-medium text-sm mt-0.5">{logsModal.orderNumber}</p>
              </div>
              <button
                onClick={() => setLogsModal(null)}
                className="p-2 rounded-xl hover:bg-surface-container transition-colors"
              >
                <Icon name="close" size={22} className="text-on-surface-variant" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {logsModal.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3">
                  <Icon name="history" size={40} />
                  <p className="font-medium text-sm">No logs for this order.</p>
                </div>
              ) : (
                logsModal.logs.map(log => {
                  const snap = (() => { try { return JSON.parse(log.snapshot) } catch { return null } })()
                  const isEdit = log.action === 'edited'
                  return (
                    <div key={log.id} className={`rounded-2xl p-5 border ${isEdit ? 'bg-secondary-container/10 border-secondary-container/30' : 'bg-error-container/10 border-error/20'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${isEdit ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-error'}`}>
                          {log.action}
                        </span>
                        <span className="text-xs text-stone-400 font-medium">
                          {new Date(log.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      {isEdit && snap?.before && (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-surface-container-lowest rounded-xl p-3">
                            <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">Before</p>
                            {snap.before.items.map((i: { name: string; quantity: number }, idx: number) => (
                              <p key={idx} className="text-on-surface font-medium">{i.quantity}× {i.name}</p>
                            ))}
                            <p className="font-black text-primary mt-1.5">₱{Number(snap.before.total).toFixed(2)}</p>
                          </div>
                          <div className="bg-surface-container-lowest rounded-xl p-3">
                            <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">After</p>
                            {snap.after.items.map((i: { menuItemId: number; name?: string; quantity: number; unitPrice: number }, idx: number) => (
                              <p key={idx} className="text-on-surface font-medium">{i.quantity}× {i.name ?? `item #${i.menuItemId}`}</p>
                            ))}
                            <p className="font-black text-primary mt-1.5">₱{Number(snap.after.total).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                      {!isEdit && snap?.items && (
                        <div className="text-xs bg-surface-container-lowest rounded-xl p-3">
                          <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">Order at cancellation</p>
                          {snap.items.map((i: { name: string; quantity: number }, idx: number) => (
                            <p key={idx} className="text-on-surface font-medium">{i.quantity}× {i.name}</p>
                          ))}
                          <p className="font-black text-primary mt-1.5">₱{Number(snap.total).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
