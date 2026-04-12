'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Stats {
  todayOrders: number
  todayRevenue: number
  pendingVerification: number
  recentOrders: Array<{
    id: number
    orderNumber: string
    status: string
    paymentMethod: string
    paymentStatus: string
    totalAmount: number
    createdAt: string
    items: Array<{ quantity: number; menuItem: { name: string } }>
  }>
  popularItems: Array<{ name: string; quantity: number }>
}

const statusColors: Record<string, string> = {
  pending_verification: 'bg-secondary-container text-on-secondary-container',
  awaiting_payment: 'bg-surface-container text-on-surface-variant',
  preparing: 'bg-tertiary-container text-on-tertiary-container',
  ready: 'bg-tertiary text-on-tertiary',
  completed: 'bg-surface-container text-on-surface-variant',
  cancelled: 'bg-error-container text-on-error-container',
}

const statusLabel: Record<string, string> = {
  pending_verification: 'Pending GCash',
  awaiting_payment: 'Awaiting Cash',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = () => {
    fetch('/api/orders/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="font-headline font-black text-2xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Dashboard
        </h2>
        <p className="text-on-surface-variant text-sm mt-1">
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="receipt_long" size={22} className="text-primary" />
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Orders Today</p>
          </div>
          <p className="font-headline font-black text-4xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {stats?.todayOrders ?? 0}
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-tertiary/10 rounded-xl flex items-center justify-center">
              <Icon name="payments" size={22} className="text-tertiary" />
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Revenue Today</p>
          </div>
          <p className="font-headline font-black text-4xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{(stats?.todayRevenue ?? 0).toFixed(0)}
          </p>
        </div>

        <div className={`rounded-xl p-6 shadow-ambient ${(stats?.pendingVerification ?? 0) > 0 ? 'bg-secondary-container' : 'bg-surface-container-lowest'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center">
              <Icon name="pending" size={22} className="text-secondary" />
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Pending GCash</p>
          </div>
          <p className="font-headline font-black text-4xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {stats?.pendingVerification ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Popular Items Chart */}
        <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden flex flex-col h-[500px]">
          <div className="px-6 py-4 border-b border-surface-container flex items-center gap-3 shrink-0">
            <Icon name="trending_up" size={20} className="text-primary" />
            <h3 className="font-headline font-bold text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Top Selling Items Today
            </h3>
          </div>
          <div className="p-6 flex-1 overflow-y-auto w-full">
            {(stats?.popularItems?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-3">
                <Icon name="analytics" size={40} className="opacity-50" />
                <p className="font-medium">No sales data yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 h-full pt-2">
                {stats?.popularItems.map((item, idx) => {
                  const maxQty = stats.popularItems[0].quantity || 1
                  const percentage = Math.max(5, (item.quantity / maxQty) * 100)
                  return (
                    <div key={idx} className="flex flex-col gap-1 w-full relative">
                      <div className="flex justify-between text-xs font-bold font-headline mb-0.5">
                        <span className="text-on-surface truncate">{item.name}</span>
                        <span className="text-primary">{item.quantity} orders</span>
                      </div>
                      <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden flex flex-col h-[500px]">
        <div className="px-6 py-4 flex items-center justify-between border-b border-surface-container">
          <h3 className="font-headline font-bold text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Recent Orders
          </h3>
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm"
          >
            <Icon name="refresh" size={16} />
            Refresh
          </button>
        </div>
        {(stats?.recentOrders?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant gap-3">
            <Icon name="receipt_long" size={40} />
            <p className="font-medium">No orders yet today</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container">
            {stats?.recentOrders.map(order => (
              <div key={order.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-container rounded-xl flex items-center justify-center shrink-0">
                  <Icon name={order.paymentMethod === 'gcash' ? 'qr_code' : 'payments'} size={22} className="text-on-surface-variant" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-headline font-black text-on-surface text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {order.orderNumber}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[order.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                    {order.items.map(i => `${i.quantity}× ${i.menuItem.name}`).join(', ')}
                  </p>
                </div>
                <p className="font-headline font-black text-primary shrink-0" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  ₱{order.totalAmount.toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
