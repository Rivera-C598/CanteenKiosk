'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Student {
  id: number
  studentIdNumber: string
  accountType: string
  fullName: string
  course: string
  year: string
  photoUrl: string
  balance: number
  status: string
  isTemporaryPin: boolean
  activatedAt: string | null
  activatedBy: { username: string } | null
  transactions: Array<{
    id: number
    type: string
    amount: number
    balanceBefore: number
    balanceAfter: number
    note: string
    createdAt: string
  }>
}

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [qrSvg, setQrSvg] = useState('')
  const [qrStudent, setQrStudent] = useState<Student | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetch_ = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/students/${id}`)
    const data = await res.json()
    setStudent(data)
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [id])

  const doAction = async (action: string) => {
    if (!confirm(`Confirm: ${action}?`)) return
    setActionLoading(true)
    await fetch(`/api/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await fetch_()
    setActionLoading(false)
  }

  const doTopup = async () => {
    const amount = parseFloat(topupAmount)
    if (!amount || amount <= 0) return
    setTopupLoading(true)
    await fetch(`/api/admin/students/${id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    setTopupAmount('')
    await fetch_()
    setTopupLoading(false)
  }

  const loadQr = async () => {
    const res = await fetch(`/api/admin/students/${id}/qr`)
    const data = await res.json()
    setQrSvg(data.svg)
    setQrStudent(data.student)
    setShowQr(true)
  }

  const printQr = () => {
    const win = window.open('', '_blank')
    if (!win || !qrStudent) return
    win.document.write(`
      <html><head><title>QR Card</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 32px; }
        .card { border: 2px solid #333; border-radius: 12px; padding: 24px; width: 280px; text-align: center; }
        svg { width: 200px; height: 200px; }
        h2 { margin: 12px 0 4px; font-size: 18px; }
        p { margin: 2px 0; font-size: 13px; color: #555; }
        .id { font-size: 11px; letter-spacing: 1px; color: #888; margin-top: 8px; }
      </style></head><body>
      <div class="card">
        ${qrSvg}
        <h2>${qrStudent.fullName}</h2>
        <p>${qrStudent.course} · ${qrStudent.year}</p>
        <p class="id">${qrStudent.studentIdNumber} · ${qrStudent.accountType}</p>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  if (loading) return <div className="p-6 flex items-center gap-3 text-on-surface-variant"><Icon name="hourglass_empty" size={24} className="animate-spin" /> Loading…</div>
  if (!student) return <div className="p-6 text-error">Student not found</div>

  const statusColor: Record<string, string> = {
    pending: 'bg-warning-container text-on-warning-container',
    active: 'bg-secondary-container text-on-secondary-container',
    frozen: 'bg-error-container text-on-error-container',
  }

  const txTypeColor: Record<string, string> = {
    topup: 'text-green-600',
    payment: 'text-error',
    refund: 'text-secondary',
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.push('/admin/students')} className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Students</span>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{student.fullName}</h1>
          <p className="text-on-surface-variant text-sm">{student.studentIdNumber} · {student.course} · {student.year}</p>
          <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${statusColor[student.status]}`}>
            {student.status}
          </span>
          {student.isTemporaryPin && (
            <span className="inline-block ml-2 text-xs px-2.5 py-1 rounded-full font-semibold bg-warning-container text-on-warning-container">
              Temp PIN active
            </span>
          )}
        </div>
        <p className="text-3xl font-black text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>₱{student.balance.toFixed(2)}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        {student.status === 'pending' && (
          <button onClick={() => doAction('activate')} disabled={actionLoading}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40">
            <Icon name="check_circle" size={18} /> Activate
          </button>
        )}
        {student.status === 'active' && (
          <button onClick={() => doAction('freeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-error-container text-on-error-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock" size={18} /> Freeze Account
          </button>
        )}
        {student.status === 'frozen' && (
          <button onClick={() => doAction('unfreeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock_open" size={18} /> Unfreeze
          </button>
        )}
        <button onClick={() => doAction('reset-pin')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="pin" size={18} /> Reset PIN
        </button>
        <button onClick={() => doAction('regen-qr')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="qr_code" size={18} /> Regen QR
        </button>
        <button onClick={showQr ? printQr : loadQr}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95">
          <Icon name="print" size={18} /> {showQr ? 'Print Card' : 'Load QR'}
        </button>
      </div>

      {/* QR Preview */}
      {showQr && qrSvg && (
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl flex items-center gap-4">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-24 h-24 shrink-0 [&>svg]:w-full [&>svg]:h-full" />
          <div>
            <p className="font-bold text-on-surface text-sm">{qrStudent?.fullName}</p>
            <p className="text-on-surface-variant text-xs">{qrStudent?.studentIdNumber}</p>
            <button onClick={printQr} className="mt-2 text-primary text-xs font-semibold flex items-center gap-1">
              <Icon name="print" size={14} /> Open print dialog
            </button>
          </div>
        </div>
      )}

      {/* Top-up */}
      {student.status === 'active' && (
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl">
          <p className="font-bold text-on-surface text-sm mb-3">Top Up Balance</p>
          <div className="flex gap-3">
            <input
              type="number"
              value={topupAmount}
              onChange={e => setTopupAmount(e.target.value)}
              placeholder="Amount (₱)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
            />
            <button onClick={doTopup} disabled={topupLoading || !topupAmount}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40">
              {topupLoading ? '…' : 'Credit'}
            </button>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <p className="font-bold text-on-surface text-sm mb-3">Recent Transactions</p>
        {student.transactions.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {student.transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest rounded-xl">
                <div>
                  <p className={`text-sm font-semibold capitalize ${txTypeColor[tx.type]}`}>{tx.type}</p>
                  <p className="text-on-surface-variant text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
                  {tx.note && <p className="text-on-surface-variant text-xs">{tx.note}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                    {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
                  </p>
                  <p className="text-on-surface-variant text-xs">bal: ₱{tx.balanceAfter.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
