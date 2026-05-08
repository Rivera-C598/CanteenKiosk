'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Me { fullName: string; studentIdNumber: string; accountType: string; balance: number }
interface Tx { id: number; type: string; amount: number; balanceAfter: number; createdAt: string }

export default function StudentDashboard() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [qrSvg, setQrSvg] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)

  useEffect(() => {
    fetch('/api/student/me').then(r => r.json()).then(setMe).catch(() => router.push('/student'))
    fetch('/api/student/transactions').then(r => r.json()).then((data: Tx[]) => setTxs(data.slice(0, 5)))
  }, [])

  const toggleQr = async () => {
    if (showQr) { setShowQr(false); return }
    if (qrSvg) { setShowQr(true); return }
    setQrLoading(true)
    const res = await fetch('/api/student/qr')
    const data = await res.json()
    if (res.ok) { setQrSvg(data.svg); setShowQr(true) }
    setQrLoading(false)
  }

  const handleLogout = async () => {
    await fetch('/api/student/logout', { method: 'POST' })
    router.push('/student')
  }

  if (!me) return null

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-on-surface-variant text-sm">Welcome back</p>
          <h1 className="text-xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{me.fullName}</h1>
        </div>
        <button onClick={handleLogout} className="p-2 text-on-surface-variant hover:text-on-surface">
          <Icon name="logout" size={22} />
        </button>
      </div>

      {/* Balance card */}
      <div className="bg-primary rounded-2xl p-6 mb-6 shadow-primary-glow">
        <p className="text-on-primary opacity-80 text-sm font-medium">Available Balance</p>
        <p className="text-on-primary font-black text-5xl mt-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          ₱{me.balance.toFixed(2)}
        </p>
        <p className="text-on-primary opacity-60 text-xs mt-2">{me.studentIdNumber} · {me.accountType}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => router.push('/student/transactions')}
          className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl active:scale-95 transition-transform">
          <Icon name="receipt_long" size={28} className="text-primary" />
          <span className="text-xs font-medium text-on-surface">History</span>
        </button>
        <button onClick={toggleQr} disabled={qrLoading}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl active:scale-95 transition-transform ${showQr ? 'bg-primary' : 'bg-surface-container-lowest'}`}>
          <Icon name="qr_code" size={28} className={showQr ? 'text-on-primary' : 'text-primary'} />
          <span className={`text-xs font-medium ${showQr ? 'text-on-primary' : 'text-on-surface'}`}>
            {qrLoading ? '…' : 'My QR'}
          </span>
        </button>
        <button onClick={() => router.push('/student/change-pin')}
          className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl active:scale-95 transition-transform">
          <Icon name="pin" size={28} className="text-primary" />
          <span className="text-xs font-medium text-on-surface">Change PIN</span>
        </button>
      </div>

      {/* QR display */}
      {showQr && qrSvg && (
        <div className="mb-4 bg-surface-container-lowest rounded-2xl p-5 flex flex-col items-center gap-3">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-48 h-48 [&>svg]:w-full [&>svg]:h-full" />
          <p className="text-on-surface-variant text-xs text-center leading-relaxed">
            Show this QR at the kiosk camera as a backup if you forgot your physical card.
            Keep this screen private.
          </p>
        </div>
      )}

      {/* Recent transactions */}
      <p className="font-bold text-on-surface text-sm mb-3">Recent</p>
      {txs.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest rounded-xl">
              <div className="flex items-center gap-3">
                <Icon name={tx.type === 'topup' ? 'add_circle' : 'remove_circle'} size={20}
                  className={tx.type === 'topup' ? 'text-green-600' : 'text-error'} />
                <div>
                  <p className="text-sm font-medium text-on-surface capitalize">{tx.type}</p>
                  <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
