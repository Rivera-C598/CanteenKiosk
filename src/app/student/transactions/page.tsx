'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'

interface OrderItem {
  quantity: number
  unitPrice: number
  menuItem: { name: string }
}

interface Tx {
  id: number
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  note: string
  createdAt: string
  admin: { username: string } | null
  order: {
    orderNumber: string
    totalAmount: number
    createdAt: string
    items: OrderItem[]
  } | null
}

export default function TransactionsPage() {
  const router = useRouter()
  const storeName = useStoreName()
  const [txs, setTxs] = useState<Tx[]>([])
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Tx['order']>(null)

  useEffect(() => {
    fetch('/api/student/transactions').then(r => r.json()).then(setTxs)
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>

      <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant mb-6">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>
      <h1 className="text-2xl font-black text-on-surface mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Transactions</h1>

      {txs.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => (
            <div key={tx.id} className="px-4 py-3 bg-surface-container-lowest rounded-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-on-surface capitalize">{tx.type}</p>
                <p className={`font-bold text-sm ${tx.balanceAfter >= tx.balanceBefore ? 'text-green-600' : 'text-error'}`}>
                  {tx.balanceAfter >= tx.balanceBefore ? '+' : '-'}&#8369;{tx.amount.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleString()}</p>
                <p className="text-xs text-on-surface-variant">bal: &#8369;{tx.balanceAfter.toFixed(2)}</p>
              </div>
              {tx.note && <p className="text-xs text-on-surface-variant mt-1">{tx.note}</p>}
              {(tx.type === 'topup' || tx.type === 'adjustment') && (
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="flex items-center gap-1 text-primary text-xs font-semibold mt-2"
                >
                  <Icon name="receipt" size={14} /> Receipt
                </button>
              )}
              {tx.type === 'payment' && tx.order && (
                <button
                  onClick={() => setSelectedOrder(tx.order)}
                  className="flex items-center gap-1 text-primary text-xs font-semibold mt-2"
                >
                  <Icon name="receipt_long" size={14} /> View Order
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-black font-mono text-sm text-center"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-2xl font-black italic mb-1">{storeName}</p>
            <p className="text-xs font-bold mb-4">CTU - Danao Campus</p>
            <div className="border-t border-black border-dashed my-3" />
            <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
              {selectedTx.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
            </p>
            <p className="text-4xl font-black mb-1">&#8369;{selectedTx.amount.toFixed(2)}</p>
            <div className="border-t border-black border-dashed my-3" />
            <p className="text-xs font-bold mb-3">REF-{String(selectedTx.id).padStart(6, '0')}</p>
            {selectedTx.admin && <p className="text-xs font-bold mb-3">By: {selectedTx.admin.username}</p>}
            <p className="text-[10px] opacity-50 mb-4 tracking-widest">
              {new Date(selectedTx.createdAt).toLocaleString('en-PH')}
            </p>
            <button
              onClick={() => window.print()}
              className="w-full bg-black text-white px-4 py-3 rounded-xl font-bold text-sm mb-2 flex items-center justify-center gap-2"
            >
              <Icon name="print" size={18} /> Print Receipt
            </button>
            <button
              onClick={() => setSelectedTx(null)}
              className="w-full text-gray-500 text-sm py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-black font-mono text-sm"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xl font-black italic text-center mb-1">{storeName}</p>
            <p className="text-xs font-bold text-center mb-3">CTU - Danao Campus</p>
            <div className="border-t border-black border-dashed my-3" />
            <div className="flex justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Order</span>
              <span className="font-black text-sm">{selectedOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Date</span>
              <span className="text-xs">{new Date(selectedOrder.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="border-t border-black border-dashed my-3" />
            <div className="space-y-2 mb-3">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="flex-1">{item.quantity}x {item.menuItem.name}</span>
                  <span className="font-bold ml-2">&#8369;{(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-black border-dashed my-3" />
            <div className="flex justify-between font-black text-base mb-4">
              <span>TOTAL</span>
              <span>&#8369;{selectedOrder.totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-center text-gray-400 mb-4 uppercase tracking-widest">Cashless Payment</p>
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full text-gray-500 text-sm py-2 border border-gray-200 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      {selectedTx && (
        <div className="print-area hidden invisible bg-white text-black w-full max-w-sm p-4 text-center font-mono text-sm leading-tight">
          <h1 className="text-2xl font-black italic mb-2 mt-4">{storeName}</h1>
          <p className="mb-4 text-xs font-bold">CTU - Danao Campus</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
            {selectedTx.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
          </p>
          <p className="text-4xl font-black mb-1">&#8369;{selectedTx.amount.toFixed(2)}</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-xs font-bold mb-4">REF-{String(selectedTx.id).padStart(6, '0')}</p>
          {selectedTx.admin && <p className="text-xs font-bold mb-4">By: {selectedTx.admin.username}</p>}
          <p className="text-[10px] mt-6 opacity-50 mb-4 tracking-widest">
            Date: {new Date(selectedTx.createdAt).toLocaleString('en-PH')}
          </p>
        </div>
      )}
    </div>
  )
}
