'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function NewStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ studentIdNumber: '', fullName: '', course: '', year: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.studentIdNumber || !form.fullName || !form.course || !form.year) {
      setError('All fields required')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create account')
      setLoading(false)
      return
    }
    const data = await res.json()
    router.push(`/admin/students/${data.id}`)
  }

  return (
    <div className="p-6 max-w-lg">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface transition-colors">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>New Account</h1>

      <div className="space-y-4">
        {[
          { label: 'Student ID Number', key: 'studentIdNumber', placeholder: '7-digit student or 6-digit faculty ID' },
          { label: 'Full Name', key: 'fullName', placeholder: 'Last, First Middle' },
          { label: 'Course / Department', key: 'course', placeholder: 'BSCS, BSIT, etc.' },
          { label: 'Year / Level', key: 'year', placeholder: '1st Year, Faculty, etc.' },
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

      {error && <p className="text-error text-sm mt-4">{error}</p>}

      <div className="mt-2 p-4 bg-secondary-container rounded-xl text-on-secondary-container text-sm">
        Temp PIN = last 4 digits of ID number. Student must change on first login.
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        {loading ? 'Creating…' : 'Create Account'}
      </button>
    </div>
  )
}
