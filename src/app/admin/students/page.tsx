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
  balance: number
  status: string
  createdAt: string
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchStudents = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/students?${params}`)
    const data = await res.json()
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [statusFilter, search])

  const statusColor: Record<string, string> = {
    pending: 'bg-warning-container text-on-warning-container',
    active: 'bg-secondary-container text-on-secondary-container',
    frozen: 'bg-error-container text-on-error-container',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Students</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">Manage cashless accounts</p>
        </div>
        <button
          onClick={() => router.push('/admin/students/new')}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-sm shadow-primary-glow active:scale-95 transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="person_add" size={18} />
          New Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ID..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
        />
        {['', 'pending', 'active', 'frozen'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
              statusFilter === s ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="hourglass_empty" size={32} className="text-on-surface-variant animate-spin" />
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Icon name="group" size={48} className="text-on-surface-variant opacity-40" />
              <p className="text-on-surface-variant text-sm">No accounts found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/admin/students/${s.id}`)}
                    className="border-b border-surface-container last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface text-sm">{s.fullName}</p>
                      <p className="text-on-surface-variant text-xs">{s.course} · {s.year}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-sm font-mono">{s.studentIdNumber}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-sm capitalize">{s.accountType}</td>
                    <td className="px-4 py-3 font-bold text-on-surface text-sm">₱{s.balance.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${statusColor[s.status] ?? ''}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
