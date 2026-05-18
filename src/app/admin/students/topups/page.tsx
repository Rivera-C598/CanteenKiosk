'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface TopupEntry {
  id: number
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  note: string
  createdAt: string
  studentAccount: {
    id: number
    fullName: string
    studentIdNumber: string
  }
  admin: {
    username: string
  } | null
}

export default function TopupAuditPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<TopupEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/students/topups')
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
  }, [])

  const totalTopups = entries.filter(e => e.type === 'topup').reduce((s, e) => s + e.amount, 0)
  const totalAdjustments = entries.filter(e => e.type === 'adjustment').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/admin/students')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="arrow_back" size={20} />
          <span className="text-sm font-medium">Students</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Top-up Audit Log
          </h1>
          <p className="text-on-surface-variant text-sm mt-0.5">All balance adjustments across all accounts</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-surface-container-lowest rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Total Top-ups</p>
          <p className="text-2xl font-black text-green-600" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{totalTopups.toFixed(2)}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Total Adjustments</p>
          <p className="text-2xl font-black text-error" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            -₱{totalAdjustments.toFixed(2)}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Transactions</p>
          <p className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {entries.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-on-surface-variant py-12 justify-center">
          <Icon name="hourglass_empty" size={24} className="animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
          <Icon name="receipt_long" size={48} className="opacity-30" />
          <p className="text-sm">No top-up transactions yet</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                {['Date', 'Ref', 'Student', 'Admin', 'Type', 'Amount', 'Balance After', 'Note'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}
                  onClick={() => router.push(`/admin/students/${e.studentAccount.id}`)}
                  className="border-b border-surface-container last:border-0 hover:bg-surface-container cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-on-surface-variant whitespace-nowrap">
                    REF-{String(e.id).padStart(6, '0')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-on-surface">{e.studentAccount.fullName}</p>
                    <p className="text-xs text-on-surface-variant font-mono">{e.studentAccount.studentIdNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{e.admin?.username ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                      e.type === 'topup' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'
                    }`}>{e.type}</span>
                  </td>
                  <td className={`px-4 py-3 font-bold text-sm ${e.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                    {e.type === 'topup' ? '+' : '-'}₱{e.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface">₱{e.balanceAfter.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant max-w-xs truncate">{e.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
