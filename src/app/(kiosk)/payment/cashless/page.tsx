'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { Html5Qrcode } from 'html5-qrcode'

type Stage = 'scanning' | 'confirm' | 'pin' | 'processing' | 'success' | 'error'

interface StudentInfo {
  id: number
  fullName: string
  studentIdNumber: string
  accountType: string
  photoUrl: string
  balance: number
}

function CashlessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('order') ?? ''
  const amount = parseFloat(searchParams.get('amount') ?? '0')
  const orderId = parseInt(searchParams.get('orderId') ?? '0')

  const [stage, setStage] = useState<Stage>('scanning')
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [lockMsg, setLockMsg] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivId = 'cashless-qr-scanner'

  useEffect(() => {
    if (stage !== 'scanning') return

    const scanner = new Html5Qrcode(scannerDivId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        await scanner.stop()
        await handleScan(decodedText)
      },
      () => {} // ignore frame errors
    ).catch(() => setError('Camera unavailable. Check browser permissions.'))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [stage])

  const handleScan = async (qrToken: string) => {
    setError('')
    const res = await fetch('/api/cashless/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid QR')
      setStage('error')
      return
    }
    setStudent({ ...data, _qrToken: qrToken } as StudentInfo & { _qrToken: string })
    setStage('confirm')
  }

  const handlePay = async () => {
    if (pin.length < 4) { setError('Enter your PIN'); return }
    setStage('processing')
    setError('')
    const qrToken = (student as unknown as { _qrToken: string })?._qrToken
    const res = await fetch('/api/cashless/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken, pin, orderId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 429) setLockMsg(data.error)
      else setError(data.error ?? 'Payment failed')
      setStage('pin')
      return
    }
    setStage('success')
    setTimeout(() => {
      router.push(`/confirmed?order=${orderNumber}&method=cashless&amount=${amount}`)
    }, 2000)
  }

  const addPinDigit = (d: string) => {
    if (pin.length < 6) setPin(p => p + d)
  }
  const delPinDigit = () => setPin(p => p.slice(0, -1))

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4 bg-surface-container-low shrink-0">
        <button onClick={() => router.push('/payment')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform">
          <Icon name="arrow_back" size={24} />
          <span className="font-body text-sm font-medium">Back</span>
        </button>
        <div className="text-xl sm:text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Cashless Pay
        </div>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">

        {/* Amount */}
        <div className="text-center">
          <p className="text-on-surface-variant font-medium mb-1">Order {orderNumber}</p>
          <p className="font-headline font-black text-5xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{amount.toFixed(0)}
          </p>
        </div>

        {/* SCANNING stage */}
        {stage === 'scanning' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <p className="text-on-surface-variant text-sm text-center">Hold your QR card in front of the camera</p>
            <div id={scannerDivId} className="w-72 h-72 rounded-xl overflow-hidden bg-black" />
            {error && <p className="text-error text-sm text-center">{error}</p>}
          </div>
        )}

        {/* CONFIRM stage */}
        {stage === 'confirm' && student && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                  <Icon name="person" size={32} className="text-on-surface-variant" />
                </div>
              )}
              <div>
                <p className="font-black text-on-surface text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{student.fullName}</p>
                <p className="text-on-surface-variant text-sm">{student.studentIdNumber} · {student.accountType}</p>
                <p className="text-primary font-bold mt-1">Balance: ₱{student.balance.toFixed(2)}</p>
              </div>
            </div>

            {student.balance < amount && (
              <div className="w-full p-4 bg-error-container rounded-xl text-on-error-container text-sm text-center">
                Insufficient balance (₱{student.balance.toFixed(2)} available)
              </div>
            )}

            <p className="text-on-surface-variant text-sm text-center">Is this the right person?</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setStage('scanning'); setStudent(null) }}
                className="flex-1 bg-surface-container text-on-surface rounded-xl py-4 font-bold active:scale-95 transition-transform">
                Not me
              </button>
              <button
                onClick={() => { if (student.balance >= amount) setStage('pin') }}
                disabled={student.balance < amount}
                className="flex-1 bg-primary text-on-primary rounded-xl py-4 font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 transition-transform">
                Correct
              </button>
            </div>
          </div>
        )}

        {/* PIN stage */}
        {(stage === 'pin' || stage === 'processing') && student && (
          <div className="w-full max-w-xs flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-on-surface font-bold">{student.fullName}</p>
              <p className="text-on-surface-variant text-sm">Enter your PIN to pay ₱{amount.toFixed(0)}</p>
            </div>

            {/* PIN dots */}
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-primary' : 'bg-surface-container'}`} />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                <button
                  key={i}
                  onClick={() => d === '⌫' ? delPinDigit() : d ? addPinDigit(d) : null}
                  disabled={stage === 'processing' || !d}
                  className={`py-4 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    d === '⌫' ? 'bg-surface-container text-on-surface' :
                    d ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'invisible'
                  } disabled:opacity-40`}
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {d}
                </button>
              ))}
            </div>

            {error && <p className="text-error text-sm text-center">{error}</p>}
            {lockMsg && <p className="text-error text-sm text-center">{lockMsg}</p>}

            <button
              onClick={handlePay}
              disabled={pin.length < 4 || stage === 'processing'}
              className="w-full bg-primary text-on-primary rounded-xl py-4 font-black text-xl shadow-primary-glow active:scale-[0.98] disabled:opacity-40 transition-transform flex items-center justify-center gap-3"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {stage === 'processing' ? (
                <><Icon name="hourglass_empty" size={24} className="animate-spin" /> Processing…</>
              ) : (
                <><Icon name="check_circle" size={24} filled /> Pay ₱{amount.toFixed(0)}</>
              )}
            </button>

            <button onClick={() => { setStage('scanning'); setStudent(null); setPin('') }}
              className="text-on-surface-variant text-sm">
              Cancel
            </button>
          </div>
        )}

        {/* SUCCESS stage */}
        {stage === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="check_circle" size={80} className="text-primary" filled />
            <p className="font-black text-2xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Payment Successful!</p>
            <p className="text-on-surface-variant text-sm">Redirecting…</p>
          </div>
        )}

        {/* ERROR stage */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="error" size={64} className="text-error" />
            <p className="text-error font-bold text-lg">{error}</p>
            <button onClick={() => { setStage('scanning'); setError('') }}
              className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-primary-glow">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function CashlessPage() {
  return (
    <Suspense>
      <CashlessContent />
    </Suspense>
  )
}
