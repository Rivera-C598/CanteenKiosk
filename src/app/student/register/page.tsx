'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function StudentRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ studentIdNumber: '', fullName: '', course: '', year: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    setDone(true)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-center">
      <Icon name="check_circle" size={64} className="text-primary mb-4" />
      <h1 className="text-2xl font-black text-on-surface mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Registration Submitted</h1>
      <p className="text-on-surface-variant text-sm max-w-xs mb-6">Visit the canteen admin with your ID for face-to-face verification. You will receive your QR card once activated.</p>
      <button onClick={() => router.push('/student')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-primary-glow">
        Back to Login
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/student')} className="text-on-surface-variant">
            <Icon name="arrow_back" size={22} />
          </button>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Register</h1>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Student ID Number', key: 'studentIdNumber', placeholder: '7-digit or 6-digit ID' },
            { label: 'Full Name', key: 'fullName', placeholder: 'Last, First Middle' },
            { label: 'Course / Department', key: 'course', placeholder: 'BSCS, BSIT…' },
            { label: 'Year / Level', key: 'year', placeholder: '1st Year, Faculty…' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-error text-sm mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !form.studentIdNumber || !form.fullName || !form.course || !form.year}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Submitting…' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}
