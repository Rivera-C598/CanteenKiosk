'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Tx { id: number; type: string; amount: number; balanceBefore: number; balanceAfter: number; note: string; createdAt: string }

export default function TransactionsPage() {
  const router = useRouter()
  const [txs, setTxs] = useState<Tx[]>([])

  useEffect(() => {
    fetch('/api/student/transactions').then(r => r.json()).then(setTxs)
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
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
                <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                  {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleString()}</p>
                <p className="text-xs text-on-surface-variant">bal: ₱{tx.balanceAfter.toFixed(2)}</p>
              </div>
              {tx.note && <p className="text-xs text-on-surface-variant mt-1">{tx.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
