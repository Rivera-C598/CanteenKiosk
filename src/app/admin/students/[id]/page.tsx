'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'

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
    admin: { username: string } | null
  }>
}

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const storeName = useStoreName()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [qrSvg, setQrSvg] = useState('')
  const [qrStudent, setQrStudent] = useState<Student | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ fullName: '', course: '', year: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pendingTopup, setPendingTopup] = useState<{ amount: number; note: string } | null>(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [printTx, setPrintTx] = useState<{
    id: number
    type: string
    amount: number
    note: string
    createdAt: string
    admin: { username: string } | null
  } | null>(null)

  const fetch_ = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/students/${id}`)
    const data = await res.json()
    setStudent(data)
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [id])

  const doAction = async (action: string) => {
    setActionLoading(true)
    setPendingAction(null)
    await fetch(`/api/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await fetch_()
    setActionLoading(false)
  }

  const [topupError, setTopupError] = useState('')

  const doTopup = () => {
    const amount = parseFloat(topupAmount)
    if (!amount || !topupNote.trim()) return
    setConfirmPassword('')
    setShowConfirmPassword(false)
    setPendingTopup({ amount, note: topupNote.trim() })
  }

  const confirmTopup = async () => {
    if (!pendingTopup) return
    setTopupLoading(true)
    setTopupError('')
    const res = await fetch(`/api/admin/students/${id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: pendingTopup.amount, note: pendingTopup.note, password: confirmPassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      setTopupError(data.error ?? 'Failed')
      setPendingTopup(null)
      setTopupLoading(false)
      return
    }
    const data = await res.json()
    setPrintTx(data.transaction)
    setTopupAmount('')
    setTopupNote('')
    const wasTopup = pendingTopup.amount > 0
    setPendingTopup(null)
    await fetch_()
    setTopupLoading(false)
    if (wasTopup) setTimeout(() => window.print(), 50)
  }

  const openEdit = () => {
    if (!student) return
    setEditForm({ fullName: student.fullName, course: student.course, year: student.year })
    setEditError('')
    setShowEdit(true)
  }

  const saveEdit = async () => {
    setEditLoading(true)
    setEditError('')
    const res = await fetch(`/api/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', ...editForm }),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? 'Failed'); setEditLoading(false); return }
    setShowEdit(false)
    await fetch_()
    setEditLoading(false)
  }

  const doDelete = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setDeleteError(data.error ?? 'Failed'); setDeleteLoading(false); return }
    router.push('/admin/students')
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
    adjustment: 'text-error',
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
          <button onClick={() => setPendingAction('activate')} disabled={actionLoading}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40">
            <Icon name="check_circle" size={18} /> Activate
          </button>
        )}
        {student.status === 'active' && (
          <button onClick={() => setPendingAction('freeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-error-container text-on-error-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock" size={18} /> Freeze Account
          </button>
        )}
        {student.status === 'frozen' && (
          <button onClick={() => setPendingAction('unfreeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock_open" size={18} /> Unfreeze
          </button>
        )}
        <button onClick={() => setPendingAction('reset-pin')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="pin" size={18} /> Reset PIN
        </button>
        <button onClick={() => setPendingAction('regen-qr')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="qr_code" size={18} /> Regen QR
        </button>
        <button onClick={showQr ? printQr : loadQr}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95">
          <Icon name="print" size={18} /> {showQr ? 'Print Card' : 'Load QR'}
        </button>
        <button onClick={openEdit}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95">
          <Icon name="edit" size={18} /> Edit Details
        </button>
        <button onClick={() => { setDeleteError(''); setShowDelete(true) }}
          className="flex items-center gap-2 bg-error-container text-on-error-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95">
          <Icon name="delete" size={18} /> Delete
        </button>
      </div>

      {/* Inline confirm bar */}
      {pendingAction && (
        <div className="mb-4 flex items-center justify-between gap-4 px-4 py-3 bg-surface-container rounded-xl border border-surface-container-high">
          <p className="text-on-surface text-sm font-medium">
            {{
              activate: 'Activate this account?',
              freeze: 'Freeze this account? Student cannot pay until unfrozen.',
              unfreeze: 'Unfreeze this account?',
              'reset-pin': 'Reset PIN to temp PIN (last 4 of ID)?',
              'regen-qr': 'Regenerate QR? Old card will stop working.',
            }[pendingAction]}
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setPendingAction(null)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-on-surface-variant bg-surface-container-lowest active:scale-95">
              Cancel
            </button>
            <button onClick={() => doAction(pendingAction)} disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-on-primary bg-primary shadow-primary-glow active:scale-95 disabled:opacity-40">
              {actionLoading ? '…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* QR Preview */}
      {showQr && qrSvg && (
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-md flex items-center gap-4">
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
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-md">
          <p className="font-bold text-on-surface text-sm mb-1">Balance Adjustment</p>
          <p className="text-on-surface-variant text-xs mb-3">Positive to add (e.g. 500), negative to deduct (e.g. -180)</p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <input
                type="number"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                placeholder="e.g. 500 or -180"
                className="flex-1 px-4 py-2.5 rounded-md bg-background border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
              />
            </div>
            <input
              type="text"
              value={topupNote}
              onChange={e => setTopupNote(e.target.value)}
              placeholder="Reference note — required (e.g. Cash received, Receipt #123)"
              className="w-full px-4 py-2.5 rounded-md bg-background border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
            />
            <button onClick={doTopup} disabled={topupLoading || !topupAmount || !topupNote.trim()}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-md text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 self-end">
              {topupLoading ? '…' : 'Apply'}
            </button>
          </div>
          {topupError && <p className="text-error text-xs font-medium mt-1">{topupError}</p>}
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
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest rounded-md">
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold capitalize ${txTypeColor[tx.type]}`}>{tx.type}</p>
                    <p className="text-xs font-mono text-on-surface-variant">REF-{String(tx.id).padStart(6, '0')}</p>
                  </div>
                  <p className="text-on-surface-variant text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
                  {tx.note && <p className="text-on-surface-variant text-xs">{tx.note}</p>}
                  {(tx.type === 'topup' || tx.type === 'adjustment') && (
                    <button
                      onClick={() => { setPrintTx(tx); setTimeout(() => window.print(), 50) }}
                      className="flex items-center gap-1 text-primary text-xs font-semibold mt-1"
                    >
                      <Icon name="print" size={14} /> Reprint
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                    {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
                    {tx.type === 'refund' ? ' (refund)' : ''}
                  </p>
                  <p className="text-on-surface-variant text-xs">bal: ₱{tx.balanceAfter.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topup confirmation modal */}
      {pendingTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Confirm {pendingTopup.amount > 0 ? 'Top-Up' : 'Adjustment'}
            </h2>
            <div className="bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-on-surface-variant text-sm">Student</span>
                <span className="text-on-surface text-sm font-bold">{student?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant text-sm">Amount</span>
                <span className={`text-sm font-bold ${pendingTopup.amount > 0 ? 'text-green-600' : 'text-error'}`}>
                  {pendingTopup.amount > 0 ? '+' : '-'}₱{Math.abs(pendingTopup.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant text-sm">Reference</span>
                <span className="text-on-surface text-sm font-medium">{pendingTopup.note}</span>
              </div>
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Enter your admin password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-container-low border border-surface-container focus:border-primary text-on-surface text-sm outline-none"
                onKeyDown={e => e.key === 'Enter' && !topupLoading && confirmPassword && confirmTopup()}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              >
                <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} size={18} />
              </button>
            </div>
            {topupError && <p className="text-error text-xs font-medium">{topupError}</p>}
            <div className="flex gap-3 mt-2">
              <button onClick={() => { setPendingTopup(null); setConfirmPassword('') }} disabled={topupLoading}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm active:scale-95 disabled:opacity-40">
                Cancel
              </button>
              <button onClick={confirmTopup} disabled={topupLoading || !confirmPassword}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-primary-glow active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2">
                <Icon name={pendingTopup && pendingTopup.amount > 0 ? 'print' : 'check'} size={16} />
                {topupLoading ? 'Processing…' : pendingTopup && pendingTopup.amount > 0 ? 'Confirm & Print' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Edit Details</h2>
            {[
              { label: 'Full Name', key: 'fullName' },
              { label: 'Course / Department', key: 'course' },
              { label: 'Year / Level', key: 'year' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wide">{label}</label>
                <input
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
            {editError && <p className="text-error text-sm">{editError}</p>}
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm active:scale-95">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editLoading}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-primary-glow active:scale-95 disabled:opacity-40">
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mx-auto">
              <Icon name="delete" size={24} className="text-error" />
            </div>
            <div className="text-center">
              <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Delete Account?</h2>
              <p className="text-on-surface-variant text-sm mt-1">
                <span className="font-bold text-on-surface">{student.fullName}</span>&apos;s account will be deactivated and hidden. Transaction history is preserved for audit purposes.
              </p>
            </div>
            {deleteError && <p className="text-error text-sm text-center">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-sm active:scale-95">
                Cancel
              </button>
              <button onClick={doDelete} disabled={deleteLoading}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold text-sm active:scale-95 disabled:opacity-40">
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>

      {printTx && (
        <div className="print-area hidden invisible bg-white text-black w-full max-w-sm p-4 text-center font-mono text-sm leading-tight">
          <h1 className="text-2xl font-black italic mb-2 mt-4">{storeName}</h1>
          <p className="mb-4 text-xs font-bold">CTU - Danao Campus</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-xl font-black mb-1">{student.fullName}</p>
          <p className="text-xs font-bold mb-4">{student.studentIdNumber}</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
            {printTx.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
          </p>
          <p className="text-4xl font-black mb-1">
            {printTx.type !== 'topup' ? '-' : ''}&#8369;{printTx.amount.toFixed(2)}
          </p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-xs font-bold mb-4">REF-{String(printTx.id).padStart(6, '0')}</p>
          {printTx.admin && <p className="text-xs font-bold mb-4">By: {printTx.admin.username}</p>}
          <p className="text-[10px] mt-6 opacity-50 mb-4 tracking-widest">
            Date: {new Date(printTx.createdAt).toLocaleString('en-PH')}
          </p>
        </div>
      )}
    </div>
  )
}
