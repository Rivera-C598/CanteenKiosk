'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'
import { Suspense } from 'react'

function StudentLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeName = useStoreName()
  const wasInactive = searchParams.get('reason') === 'inactive'
  const [studentIdNumber, setStudentIdNumber] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIdNumber, pin }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      setLoading(false)
      return
    }
    router.push(data.isTemporaryPin ? '/student/change-pin' : '/student/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-primary-glow">
            <Icon name="account_balance_wallet" size={32} className="text-on-primary" />
          </div>
          <h1 className="text-3xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {storeName} Pay
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Student Cashless Account</p>
        </div>

        {wasInactive && (
          <div className="flex items-center gap-2 bg-warning-container text-on-warning-container px-4 py-3 rounded-xl text-sm font-medium">
            <Icon name="schedule" size={18} className="shrink-0" />
            You were automatically logged out due to inactivity.
          </div>
        )}

        <div className="space-y-4">
          <input
            value={studentIdNumber}
            onChange={e => setStudentIdNumber(e.target.value)}
            placeholder="Student ID Number"
            className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-lg font-mono tracking-widest"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-2xl tracking-[0.5em]"
          />
        </div>

        {error && <p className="text-error text-sm text-center mt-3">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading || !studentIdNumber || !pin}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <button
          onClick={() => router.push('/student/register')}
          className="w-full mt-3 text-on-surface-variant text-sm py-2 hover:text-on-surface transition-colors"
        >
          No account? Register here
        </button>
      </div>
    </div>
  )
}

export default function StudentLoginPage() {
  return (
    <Suspense>
      <StudentLoginContent />
    </Suspense>
  )
}
