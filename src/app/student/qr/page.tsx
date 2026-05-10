'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function StudentQrPage() {
  const router = useRouter()
  const [qrSvg, setQrSvg] = useState('')
  const [info, setInfo] = useState<{ fullName: string; studentIdNumber: string; accountType: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/student/qr')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setQrSvg(data.svg)
        setInfo({ fullName: data.fullName, studentIdNumber: data.studentIdNumber, accountType: data.accountType })
      })
      .catch(() => setError('Failed to load QR'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 bg-surface-container-low shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant active:scale-95">
          <Icon name="arrow_back" size={22} />
          <span className="text-sm font-medium">Back</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {loading && (
          <Icon name="hourglass_empty" size={36} className="text-on-surface-variant animate-spin" />
        )}

        {error && (
          <div className="text-center">
            <Icon name="error" size={48} className="text-error mb-3" />
            <p className="text-error font-medium">{error}</p>
          </div>
        )}

        {qrSvg && info && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {info.fullName}
              </h1>
              <p className="text-on-surface-variant text-sm mt-1">{info.studentIdNumber} · {info.accountType}</p>
            </div>

            {/* QR — large and centered */}
            <div className="w-80 h-80 sm:w-96 sm:h-96 bg-white rounded-2xl p-3 shadow-ambient">
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-full h-full [&>svg]:w-full [&>svg]:h-full" />
            </div>

            <div className="bg-secondary-container rounded-xl px-4 py-3 max-w-xs text-center">
              <p className="text-on-secondary-container text-sm font-medium leading-relaxed">
                Show this to the kiosk camera when paying. Keep this screen private.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
