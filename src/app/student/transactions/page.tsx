'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'

interface Tx {
  id: number
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  note: string
  createdAt: string
  admin: { username: string } | null
}

export default function TransactionsPage() {
  const router = useRouter()
  const storeName = useStoreName()
  const [txs, setTxs] = useState<Tx[]>([])
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null)

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
            <div key={tx.id} className="px-4 py-3 bg-surface-container-lowest rounded-xl">
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
            <p className="text-sm font-bold mb-1">Before: &#8369;{selectedTx.balanceBefore.toFixed(2)}</p>
            <p className="text-sm font-bold mb-3">After: &#8369;{selectedTx.balanceAfter.toFixed(2)}</p>
            {selectedTx.note && <p className="text-xs font-bold mb-1">Ref: {selectedTx.note}</p>}
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
          <p className="text-sm font-bold mb-1">Before: &#8369;{selectedTx.balanceBefore.toFixed(2)}</p>
          <p className="text-sm font-bold mb-4">After: &#8369;{selectedTx.balanceAfter.toFixed(2)}</p>
          {selectedTx.note && <p className="text-xs font-bold mb-1">Ref: {selectedTx.note}</p>}
          {selectedTx.admin && <p className="text-xs font-bold mb-4">By: {selectedTx.admin.username}</p>}
          <p className="text-[10px] mt-6 opacity-50 mb-4 tracking-widest">
            Date: {new Date(selectedTx.createdAt).toLocaleString('en-PH')}
          </p>
        </div>
      )}
    </div>
  )
}
