'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function ChangePinPage() {
  const router = useRouter()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = async () => {
    if (newPin !== confirmPin) { setError('PINs do not match'); return }
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    router.push('/student/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-on-surface-variant">
            <Icon name="arrow_back" size={22} />
          </button>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Change PIN</h1>
        </div>

        <div className="p-4 bg-secondary-container rounded-xl mb-6 text-on-secondary-container text-sm">
          Choose a new 4–6 digit PIN. You will use this at the kiosk when paying.
        </div>

        <div className="space-y-4">
          {[
            { label: 'Current PIN', val: currentPin, set: setCurrentPin },
            { label: 'New PIN', val: newPin, set: setNewPin },
            { label: 'Confirm New PIN', val: confirmPin, set: setConfirmPin },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">{label}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={val}
                onChange={e => set(e.target.value)}
                className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-2xl tracking-[0.5em]"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-error text-sm text-center mt-3">{error}</p>}

        <button
          onClick={handleChange}
          disabled={loading || !currentPin || !newPin || !confirmPin}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Saving…' : 'Set New PIN'}
        </button>
      </div>
    </div>
  )
}
